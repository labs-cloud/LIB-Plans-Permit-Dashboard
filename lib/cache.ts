import { unstable_cache } from 'next/cache';
import { hasClickUpToken } from './clickup';
import { computeKpis, computePermitsPanel } from './kpis';
import { computeMatrixColumns, computeSetTypes } from './plan-type-map';
import { computeSticking } from './sticking';
import { loadAllProjects } from './transforms';
import type { DashboardPayload } from './types';
import { CACHE_TTL_SECONDS } from './constants';

export const PROJECTS_CACHE_TAG = 'projects';

async function buildPayload(): Promise<DashboardPayload> {
  if (!hasClickUpToken()) {
    return {
      projects: [],
      matrixColumns: [],
      setTypes: [],
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
      warning: 'CLICKUP_API_TOKEN is not set. Add it to .env.local to load live data.',
    };
  }

  const now = Date.now();
  const projects = await loadAllProjects();
  return {
    projects,
    matrixColumns: computeMatrixColumns(projects),
    setTypes: computeSetTypes(projects),
    kpis: computeKpis(projects, now),
    sticking: computeSticking(projects, now),
    permits: computePermitsPanel(projects, now),
    syncedAt: now,
    source: 'live',
  };
}

export const getDashboardPayload = unstable_cache(
  buildPayload,
  ['lib-plans-permits-dashboard:v1'],
  {
    revalidate: CACHE_TTL_SECONDS,
    tags: [PROJECTS_CACHE_TAG],
  },
);
