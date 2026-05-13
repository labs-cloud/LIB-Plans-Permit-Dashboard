'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';

import type { CoordinatorId, PhaseId } from '@/lib/constants';
import { COORD_BY_ID, PHASES } from '@/lib/constants';
import type { DashboardPayload, KpiStripData, PermitsPanelData, Project, StickingItem } from '@/lib/types';
import { computeKpis, computePermitsPanel } from '@/lib/kpis';
import { buildMatrix, computeMatrixColumns } from '@/lib/plan-type-map';
import { computeSticking } from '@/lib/sticking';

import { LogoHeader } from './LogoHeader';
import { FilterBar, type ViewMode } from './FilterBar';
import { KpiStrip } from './KpiStrip';
import { CoordinatorRoster } from './CoordinatorRoster';
import { OverviewView } from './OverviewView';
import { DetailedView } from './DetailedView';
import type { SortKey } from './SortChips';

const fetcher = async (url: string): Promise<DashboardPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const EMPTY_PAYLOAD: DashboardPayload = {
  projects: [],
  matrixColumns: [],
  assetTypes: [],
  kpis: { filingsInFlight: 0, approved7d: 0, waitingOn: 0, expiring30d: 0, expired: 0 },
  sticking: [],
  permits: {
    active: 0,
    activeProjects: 0,
    expiring30d: 0,
    expiring30dProjects: 0,
    expired: 0,
    timeline: { overdue: 0, d0_7: 0, d8_30: 0, d31_60: 0, d61_90: 0 },
    byAgency: [],
    attention: [],
    allPermitsListIds: [],
  },
  syncedAt: Date.now(),
  source: 'empty',
};

interface Props {
  initial: DashboardPayload | null;
  initialError?: string | null;
}

function readParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = params.get(key);
  if (v && (allowed as readonly string[]).includes(v)) return v as T;
  return fallback;
}

const SORT_KEYS: readonly SortKey[] = ['urgency', 'coord', 'phase', 'name', 'activity'] as const;
const COORD_KEYS: readonly (CoordinatorId | 'all')[] = ['all', 'faigy', 'malky', 'unassigned'] as const;
const PHASE_KEYS: readonly (PhaseId | 'all')[] = ['all', 'pre', 'con', 'post'] as const;
const VIEW_KEYS: readonly ViewMode[] = ['overview', 'detailed'] as const;

function sortProjects(list: Project[], key: SortKey): Project[] {
  const arr = [...list];
  if (key === 'urgency') arr.sort((a, b) => a.urgency - b.urgency || a.name.localeCompare(b.name));
  else if (key === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (key === 'phase')
    arr.sort(
      (a, b) =>
        (a.phase ?? 'zz').localeCompare(b.phase ?? 'zz') || a.urgency - b.urgency,
    );
  else if (key === 'coord')
    arr.sort((a, b) => a.coord.localeCompare(b.coord) || a.urgency - b.urgency);
  else if (key === 'activity') arr.sort((a, b) => b.lastActivity - a.lastActivity);
  return arr;
}

export function Dashboard({ initial, initialError }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = readParam(searchParams, 'view', VIEW_KEYS, 'overview');
  const coord = readParam(searchParams, 'coord', COORD_KEYS, 'all');
  const phase = readParam(searchParams, 'phase', PHASE_KEYS, 'all');
  const sort = readParam(searchParams, 'sort', SORT_KEYS, 'urgency');
  const search = searchParams.get('q') ?? '';
  const assetTypeRaw = searchParams.get('assetType') ?? 'all';
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  const { data, error } = useSWR<DashboardPayload>('/api/projects', fetcher, {
    fallbackData: initial ?? undefined,
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const payload = data ?? initial ?? EMPTY_PAYLOAD;

  // Validate Asset Type filter against options the server actually returned —
  // falls back to 'all' if the URL holds a stale value.
  const assetType =
    assetTypeRaw !== 'all' && payload.assetTypes.includes(assetTypeRaw) ? assetTypeRaw : 'all';

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === '') params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams],
  );

  const setView = (v: ViewMode) => setParam({ view: v === 'overview' ? null : v });
  const setCoord = (c: CoordinatorId | 'all') => setParam({ coord: c === 'all' ? null : c });
  const setPhase = (p: PhaseId | 'all') => setParam({ phase: p === 'all' ? null : p });
  const setAssetType = (s: string | 'all') => setParam({ assetType: s === 'all' ? null : s });
  const setSort = (s: SortKey) => setParam({ sort: s === 'urgency' ? null : s });

  // Debounced commit of search to URL.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === search) return;
      setParam({ q: searchInput || null });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [searchInput, search, setParam]);

  // Stage 1: project-level filters (coord, phase, search). Plans are still
  // the full set at this point.
  const projectFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payload.projects.filter((p) => {
      if (coord !== 'all' && p.coord !== coord) return false;
      if (phase !== 'all' && p.phase !== phase) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payload.projects, coord, phase, search]);

  // Stage 2: plan-level Asset Type filter — replaces each project's plan list
  // and re-derives the matrix so the matrix dots reflect only matching plans.
  const filtered = useMemo(() => {
    if (assetType === 'all') return projectFiltered;
    return projectFiltered.map((project) => {
      const plans = project.plans.filter((plan) => plan.assetType === assetType);
      return { ...project, plans, matrix: buildMatrix(plans) };
    });
  }, [projectFiltered, assetType]);

  // Matrix columns reflect ALL active filters — when filtering by Asset Type
  // we don't want empty plan-type columns crowding the matrix.
  const matrixColumns = useMemo(() => computeMatrixColumns(filtered), [filtered]);

  const sorted = useMemo(() => sortProjects(filtered, sort), [filtered, sort]);

  const filtersActive = coord !== 'all' || phase !== 'all' || assetType !== 'all' || !!search;

  const filteredKpis: KpiStripData = useMemo(
    () => (filtersActive ? computeKpis(filtered) : payload.kpis),
    [filtersActive, filtered, payload.kpis],
  );
  const filteredSticking: StickingItem[] = useMemo(
    () => (filtersActive ? computeSticking(filtered) : payload.sticking),
    [filtersActive, filtered, payload.sticking],
  );
  const filteredPermits: PermitsPanelData = useMemo(
    () => (filtersActive ? computePermitsPanel(filtered) : payload.permits),
    [filtersActive, filtered, payload.permits],
  );

  const filterTagBits: string[] = [];
  if (coord !== 'all') filterTagBits.push(COORD_BY_ID[coord].name);
  if (phase !== 'all') filterTagBits.push(PHASES.find((p) => p.id === phase)?.label ?? phase);
  if (assetType !== 'all') filterTagBits.push(assetType);
  if (search) filterTagBits.push(`“${search}”`);
  const filterTag = filterTagBits.length ? filterTagBits.join(' · ') : null;

  const errMessage = initialError ?? (error ? String(error) : null);
  const warning = errMessage ?? payload.warning ?? null;

  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '1.5rem',
      }}
    >
      <LogoHeader
        shownCount={sorted.length}
        totalCount={payload.projects.length}
        syncedAt={payload.syncedAt}
        filterLine={filterTag}
        warning={warning}
      />

      <FilterBar
        search={searchInput}
        coord={coord}
        phase={phase}
        assetType={assetType}
        assetTypeOptions={payload.assetTypes}
        view={view}
        onSearchChange={setSearchInput}
        onCoordChange={setCoord}
        onPhaseChange={setPhase}
        onAssetTypeChange={setAssetType}
        onViewChange={setView}
      />

      <CoordinatorRoster
        projects={payload.projects}
        activeCoord={coord}
        onCoordToggle={(c) => setCoord(coord === c ? 'all' : c)}
      />

      <KpiStrip data={filteredKpis} projects={filtered} />

      {view === 'overview' ? (
        <OverviewView
          projects={sorted}
          matrixColumns={matrixColumns}
          totalCount={payload.projects.length}
          sticking={filteredSticking}
          activeCoord={coord}
          activePhase={phase}
          onPhaseToggle={(p) => setPhase(phase === p ? 'all' : p)}
          filterTag={filterTag}
        />
      ) : (
        <DetailedView
          projects={sorted}
          permits={filteredPermits}
          sort={sort}
          onSortChange={setSort}
        />
      )}

      <div
        style={{
          marginTop: '1.5rem',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
        }}
      >
        Live from ClickUp · 60-second cache · click any project, status dot, capsule or permit to
        open in ClickUp
      </div>
    </div>
  );
}
