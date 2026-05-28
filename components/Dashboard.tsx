'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';

import type { DashboardPayload } from '@/lib/types';
import { computeKpis, computePermitsPanel } from '@/lib/kpis';
import { computeSticking } from '@/lib/sticking';

import { LogoHeader } from './LogoHeader';
import { ProjectPicker } from './ProjectPicker';
import { OverviewView } from './OverviewView';
import { MatrixView } from './MatrixView';

const fetcher = async (url: string): Promise<DashboardPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const EMPTY_PAYLOAD: DashboardPayload = {
  projects: [],
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
  projectId?: string;
}

export function Dashboard({ initial, initialError, projectId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = searchParams?.get('embed') === '1';

  const search = searchParams?.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  // Stable ref so the debounce effect doesn't re-arm on every render.
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (q) params.set('q', q);
      else params.delete('q');
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === search) return;
      setSearch(searchInput || '');
    }, 200);
    return () => window.clearTimeout(handle);
  }, [searchInput, search, setSearch]);

  const { data, error } = useSWR<DashboardPayload>('/api/projects', fetcher, {
    fallbackData: initial ?? undefined,
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
  });

  const payload = data ?? initial ?? EMPTY_PAYLOAD;
  const errMessage = initialError ?? (error ? String(error) : null);
  const warning = errMessage ?? payload.warning ?? null;

  const allProjectNames = useMemo(
    () => payload.projects.map((p) => p.name),
    [payload.projects],
  );

  // Portfolio: search-filtered project list for the matrix.
  const portfolioProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payload.projects;
    return payload.projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [payload.projects, search]);

  // Per-project: resolve the single selected project from the full payload.
  const selectedProject = useMemo(
    () => (projectId ? (payload.projects.find((p) => p.name === projectId) ?? null) : null),
    [payload.projects, projectId],
  );

  const singleKpis = useMemo(
    () => (selectedProject ? computeKpis([selectedProject]) : EMPTY_PAYLOAD.kpis),
    [selectedProject],
  );
  const singleSticking = useMemo(
    () => (selectedProject ? computeSticking([selectedProject]) : []),
    [selectedProject],
  );
  const singlePermits = useMemo(
    () => (selectedProject ? computePermitsPanel([selectedProject]) : EMPTY_PAYLOAD.permits),
    [selectedProject],
  );

  const navigateToProject = useCallback(
    (name: string) => router.push(`/plans/${encodeURIComponent(name)}`),
    [router],
  );
  const navigateToPortfolio = useCallback(() => router.push('/'), [router]);

  return (
    <div
      className="dashboard-shell"
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
      }}
    >
      {!isEmbed && !projectId && (
        <LogoHeader
          shownCount={portfolioProjects.length}
          totalCount={payload.projects.length}
          syncedAt={payload.syncedAt}
          warning={warning}
        />
      )}
      {!isEmbed && projectId && (
        <LogoHeader
          title="Plans Dashboard"
          subtitleOverride={projectId}
          syncedAt={payload.syncedAt}
          warning={warning}
        />
      )}

      {/* Toolbar: search (portfolio only) + project picker */}
      <div
        className="budget-toolbar"
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        {!projectId && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <i
              className="ti ti-search"
              style={{
                position: 'absolute',
                left: 8,
                fontSize: 13,
                color: 'var(--color-text-tertiary)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              placeholder="Search projects…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                height: 32,
                paddingLeft: 26,
                paddingRight: 8,
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 'var(--border-radius-md)',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: 13,
                width: 200,
                outline: 'none',
              }}
            />
          </div>
        )}
        <ProjectPicker
          projectId={projectId}
          projectNames={allProjectNames}
          onPortfolio={navigateToPortfolio}
          onProject={navigateToProject}
          isEmbed={isEmbed}
        />
      </div>

      {/* Per-project mode */}
      {projectId && (
        <>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginBottom: 16,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <button
              onClick={navigateToPortfolio}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-info)',
                cursor: 'pointer',
                padding: 0,
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              Portfolio
            </button>
            <i className="ti ti-chevron-right" style={{ fontSize: 14, opacity: 0.6 }} />
            <span>{projectId}</span>
          </div>

          {selectedProject ? (
            <OverviewView
              projects={[selectedProject]}
              totalCount={1}
              sticking={singleSticking}
              kpis={singleKpis}
              permits={singlePermits}
              activeCoord="all"
              activePhase="all"
              onCoordToggle={() => {}}
              onPhaseToggle={() => {}}
              onSwitchToDetailed={() => {}}
            />
          ) : (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: 13,
              }}
            >
              {payload.projects.length === 0
                ? 'Loading project data…'
                : `Project "${projectId}" was not found.`}
            </div>
          )}
        </>
      )}

      {/* Portfolio mode: project × plan-type matrix */}
      {!projectId && <MatrixView projects={portfolioProjects} />}

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
