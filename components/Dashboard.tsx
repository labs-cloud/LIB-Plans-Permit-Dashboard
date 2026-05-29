'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';

import type { DashboardPayload, Project } from '@/lib/types';
import { computeKpis, computePermitsPanel } from '@/lib/kpis';
import { computeSticking } from '@/lib/sticking';

import { LogoHeader } from './LogoHeader';
import { ProjectPicker } from './ProjectPicker';
import { KpiStrip } from './KpiStrip';
import { CoordinatorRoster } from './CoordinatorRoster';
import { OverviewView } from './OverviewView';
import { DetailedView } from './DetailedView';
import { MatrixView } from './MatrixView';
import type { SortKey } from './SortChips';
import type { ChipStyle, DetailedLayout } from './ViewSettings';

// ── Types ─────────────────────────────────────────────────────────
type ViewMode = 'overview' | 'detailed' | 'matrix';

const VIEW_TABS: { id: ViewMode; icon: string; label: string }[] = [
  { id: 'overview', icon: 'ti-grid-dots',    label: 'Overview' },
  { id: 'detailed', icon: 'ti-list-details', label: 'Detailed' },
  { id: 'matrix',   icon: 'ti-table',        label: 'Matrix'   },
];

const VIEW_KEYS:   readonly ViewMode[]        = ['overview', 'detailed', 'matrix'] as const;
const SORT_KEYS:   readonly SortKey[]         = ['urgency', 'coord', 'phase', 'name', 'activity'] as const;
const LAYOUT_KEYS: readonly DetailedLayout[]  = ['A', 'B', 'C', 'D'] as const;
const CHIP_KEYS:   readonly ChipStyle[]       = ['solid', 'dot', 'stripe'] as const;

// ── Helpers ───────────────────────────────────────────────────────
const DEFAULT_VIEW_STORAGE_KEY = 'lib.dashboard.defaultView';

function readDefaultView(): ViewMode {
  if (typeof window === 'undefined') return 'overview';
  try {
    const saved = window.localStorage.getItem(DEFAULT_VIEW_STORAGE_KEY);
    if (saved && (VIEW_KEYS as readonly string[]).includes(saved)) return saved as ViewMode;
  } catch { /* ignore — private mode, sandbox iframe, etc. */ }
  return 'overview';
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

function sortProjects(list: Project[], key: SortKey): Project[] {
  const arr = [...list];
  if (key === 'urgency')   arr.sort((a, b) => a.urgency - b.urgency || a.name.localeCompare(b.name));
  else if (key === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (key === 'phase')    arr.sort((a, b) => (a.phase ?? 'zz').localeCompare(b.phase ?? 'zz') || a.urgency - b.urgency);
  else if (key === 'coord')    arr.sort((a, b) => a.coord.localeCompare(b.coord) || a.urgency - b.urgency);
  else if (key === 'activity') arr.sort((a, b) => b.lastActivity - a.lastActivity);
  return arr;
}

// ── Constants ─────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────
interface Props {
  initial: DashboardPayload | null;
  initialError?: string | null;
  projectId?: string;
}

export function Dashboard({ initial, initialError, projectId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = searchParams?.get('embed') === '1';

  // ── URL-driven state ────────────────────────────────────────────
  const view      = readParam(searchParams, 'view',   VIEW_KEYS,   'overview');
  const sort      = readParam(searchParams, 'sort',   SORT_KEYS,   'urgency');
  const layout    = readParam(searchParams, 'layout', LAYOUT_KEYS, 'A');
  const chipStyle = readParam(searchParams, 'chip',   CHIP_KEYS,   'solid');
  const search    = searchParams?.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  // ── Default-view preference (localStorage) ──────────────────────
  const [defaultView, setDefaultViewState] = useState<ViewMode>('overview');
  useEffect(() => setDefaultViewState(readDefaultView()), []);

  const setDefaultView = useCallback((v: ViewMode | null) => {
    const next = v ?? 'overview';
    setDefaultViewState(next);
    try {
      if (v === null || v === 'overview') {
        window.localStorage.removeItem(DEFAULT_VIEW_STORAGE_KEY);
      } else {
        window.localStorage.setItem(DEFAULT_VIEW_STORAGE_KEY, v);
      }
    } catch { /* ignore */ }
  }, []);

  // Stable ref so setParam stays identity-stable across renders.
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === '') params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router],
  );

  const setView      = (v: ViewMode)       => setParam({ view:   v === 'overview' ? null : v });
  const setSort      = (s: SortKey)        => setParam({ sort:   s === 'urgency'  ? null : s });
  const setLayout    = (l: DetailedLayout) => setParam({ layout: l === 'A'        ? null : l });
  const setChipStyle = (c: ChipStyle)      => setParam({ chip:   c === 'solid'    ? null : c });

  // On first mount, if no explicit ?view= is in the URL, apply the saved default.
  const didApplyDefaultRef = useRef(false);
  useEffect(() => {
    if (didApplyDefaultRef.current) return;
    didApplyDefaultRef.current = true;
    const saved = readDefaultView();
    if (saved === 'overview') return;
    if (searchParamsRef.current.get('view')) return;
    setParam({ view: saved });
  }, [setParam]);

  // Debounced commit of the search input to URL.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === search) return;
      setParam({ q: searchInput || null });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [searchInput, search, setParam]);

  // ── Data ────────────────────────────────────────────────────────
  const { data, error } = useSWR<DashboardPayload>('/api/projects', fetcher, {
    fallbackData: initial ?? undefined,
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
  });

  const payload    = data ?? initial ?? EMPTY_PAYLOAD;
  const errMessage = initialError ?? (error ? String(error) : null);
  const warning    = errMessage ?? payload.warning ?? null;

  const allProjectNames = useMemo(
    () => payload.projects.map((p) => p.name),
    [payload.projects],
  );

  // ── Portfolio scope (search only — coord/phase/assetType removed) ──
  const portfolioFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payload.projects;
    return payload.projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [payload.projects, search]);

  const portfolioSorted  = useMemo(() => sortProjects(portfolioFiltered, sort), [portfolioFiltered, sort]);
  const portfolioKpis    = useMemo(() => search ? computeKpis(portfolioFiltered)       : payload.kpis,    [search, portfolioFiltered, payload.kpis]);
  const portfolioSticking = useMemo(() => search ? computeSticking(portfolioFiltered)   : payload.sticking, [search, portfolioFiltered, payload.sticking]);
  const portfolioPermits  = useMemo(() => search ? computePermitsPanel(portfolioFiltered) : payload.permits,  [search, portfolioFiltered, payload.permits]);

  // ── Per-project scope ────────────────────────────────────────────
  const selectedProject = useMemo(
    () => (projectId ? (payload.projects.find((p) => p.name === projectId) ?? null) : null),
    [payload.projects, projectId],
  );
  const singleList     = useMemo(() => (selectedProject ? [selectedProject] : []), [selectedProject]);
  const singleKpis     = useMemo(() => (selectedProject ? computeKpis([selectedProject])          : EMPTY_PAYLOAD.kpis),    [selectedProject]);
  const singleSticking = useMemo(() => (selectedProject ? computeSticking([selectedProject])       : []),                    [selectedProject]);
  const singlePermits  = useMemo(() => (selectedProject ? computePermitsPanel([selectedProject])   : EMPTY_PAYLOAD.permits), [selectedProject]);

  // ── Active scope (unified — per-project overrides portfolio) ─────
  const activeProjects = projectId ? singleList     : portfolioSorted;
  const activeKpis     = projectId ? singleKpis     : portfolioKpis;
  const activeSticking = projectId ? singleSticking : portfolioSticking;
  const activePermits  = projectId ? singlePermits  : portfolioPermits;
  const activeTotalCount = projectId ? 1 : payload.projects.length;

  // ── Navigation ───────────────────────────────────────────────────
  const navigateToProject  = useCallback((name: string) => router.push(`/plans/${encodeURIComponent(name)}`), [router]);
  const navigateToPortfolio = useCallback(() => router.push('/'), [router]);

  // ── View-toggle pin helpers ──────────────────────────────────────
  const isDefaultView = view === defaultView;
  const pinLabel = isDefaultView
    ? `${VIEW_TABS.find((t) => t.id === view)?.label} is your default — click to clear`
    : `Set ${VIEW_TABS.find((t) => t.id === view)?.label} as the default view on launch`;

  // Guard: don't render view content while per-project data is still loading
  const projectReady = !projectId || !!selectedProject;

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
          shownCount={portfolioFiltered.length}
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

      {/* ── Top bar: search · picker · view-toggle · pin ── */}
      <div
        className="filter-bar"
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Search — portfolio mode only */}
        {!projectId && (
          <input
            className="filter-search"
            type="search"
            placeholder="Search projects…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: 1, minWidth: 160, maxWidth: 220, fontSize: 13 }}
          />
        )}

        {/* Project picker */}
        <ProjectPicker
          projectId={projectId}
          projectNames={allProjectNames}
          onPortfolio={navigateToPortfolio}
          onProject={navigateToProject}
          isEmbed={isEmbed}
        />

        {/* View toggle + pin — pushed to the right */}
        <div className="view-toggle-wrap" style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <div
            className="view-toggle"
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              background: 'var(--color-background-secondary)',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            {VIEW_TABS.map((tab) => {
              const active       = view === tab.id;
              const tabIsDefault = defaultView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab ${active ? 'active' : ''}`}
                  onClick={() => setView(tab.id)}
                  title={tabIsDefault ? `${tab.label} (default)` : tab.label}
                  style={{ position: 'relative' }}
                >
                  <i
                    className={`ti ${tab.icon}`}
                    style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }}
                  />
                  {tab.label}
                  {tabIsDefault && (
                    <i
                      className="ti ti-pin-filled"
                      aria-hidden="true"
                      style={{ fontSize: 10, marginLeft: 5, color: 'var(--lib-orange)', verticalAlign: 1 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="filter-pin-default"
            onClick={() => setDefaultView(isDefaultView ? null : view)}
            title={pinLabel}
            aria-label={pinLabel}
            aria-pressed={isDefaultView}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              border: `0.5px solid ${isDefaultView ? 'var(--lib-orange)' : 'var(--color-border-secondary)'}`,
              background: isDefaultView ? '#FEF1E5' : 'var(--color-background-primary)',
              color: isDefaultView ? '#7A3A11' : 'var(--color-text-secondary)',
              borderRadius: 'var(--border-radius-md)',
              cursor: 'pointer',
            }}
          >
            <i
              className={`ti ${isDefaultView ? 'ti-pin-filled' : 'ti-pin'}`}
              style={{ fontSize: 15 }}
            />
          </button>
        </div>
      </div>

      {/* Per-project breadcrumb */}
      {projectId && (
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
      )}

      {/* Not-found state for per-project mode */}
      {projectId && !selectedProject && payload.projects.length > 0 && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 13,
          }}
        >
          Project &quot;{projectId}&quot; was not found.
        </div>
      )}

      {/* ── View content ── */}

      {view === 'detailed' && projectReady && (
        <>
          <CoordinatorRoster
            projects={activeProjects}
            activeCoord="all"
            onCoordToggle={() => {}}
          />
          <KpiStrip data={activeKpis} projects={activeProjects} />
          <DetailedView
            projects={activeProjects}
            permits={activePermits}
            sort={sort}
            onSortChange={setSort}
            layout={layout}
            chipStyle={chipStyle}
            onLayoutChange={setLayout}
            onChipStyleChange={setChipStyle}
          />
        </>
      )}

      {view === 'matrix' && projectReady && (
        <>
          <KpiStrip data={activeKpis} projects={activeProjects} />
          <MatrixView projects={activeProjects} />
        </>
      )}

      {view === 'overview' && projectReady && (
        <OverviewView
          projects={activeProjects}
          totalCount={activeTotalCount}
          sticking={activeSticking}
          kpis={activeKpis}
          permits={activePermits}
          activeCoord="all"
          activePhase="all"
          onCoordToggle={() => {}}
          onPhaseToggle={() => {}}
          onSwitchToDetailed={() => setView('detailed')}
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
