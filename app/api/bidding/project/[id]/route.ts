import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getListsInFolder, getTasksInList } from '@/lib/clickup';
import { transformBiddingTasks, transformBiddingTasksByName } from '@/lib/bidding-transforms';
import type { BiddingPayload, BiddingProject, PortfolioProjectStub } from '@/lib/bidding-types';
import type { ClickUpList } from '@/lib/clickup';
import { CLICKUP, CACHE_TTL_SECONDS } from '@/lib/constants';
import { BIDDING_CACHE_TAG } from '@/lib/cache';

export const revalidate = 60;
export const runtime = 'nodejs';

const EMPTY_PROJECT: BiddingProject = {
  name: '—',
  location: '—',
  id: '—',
  phase: 'Bidding',
  coordInitials: '—',
  coordName: '—',
  trades: [],
};

const F = CLICKUP.FIELD;

function getFieldText(
  task: { custom_fields?: Array<{ id: string; value?: unknown }> },
  fieldId: string,
): string | null {
  const f = task.custom_fields?.find((cf) => cf.id === fieldId);
  if (!f || f.value == null) return null;
  return typeof f.value === 'string' ? f.value.trim() || null : null;
}

function findBiddingList(lists: ClickUpList[]): ClickUpList | undefined {
  const candidates = ['02. bidding', '02 bidding', 'bidding'];
  for (const candidate of candidates) {
    const found = lists.find((l) => l.name.toLowerCase() === candidate);
    if (found) return found;
  }
  return undefined;
}

async function buildPayload(projectId: string): Promise<BiddingPayload> {
  if (!hasClickUpToken()) {
    return {
      project: EMPTY_PROJECT,
      portfolioProjects: [],
      syncedAt: 0,
      source: 'empty',
      warning: 'CLICKUP_API_TOKEN is not set. Add it to .env.local to load live data.',
    };
  }

  const folders = await getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID);

  const portfolioProjects: PortfolioProjectStub[] = folders.map((f) => ({
    name: f.name,
    location: '',
    isReal: true,
  }));

  const targetFolder = folders.find((f) => f.name === projectId) ?? folders[0];

  if (!targetFolder) {
    return { project: EMPTY_PROJECT, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  const targetName = targetFolder.name;
  const lists = await getListsInFolder(targetFolder.id);
  const biddingList = findBiddingList(lists);

  if (biddingList) {
    // Per-project path: must include subtasks — parent tasks = trades, subtasks = sub bids.
    const tasks = await getTasksInList(biddingList.id, true, true);
    const project = transformBiddingTasksByName(tasks, targetName, '', targetName, '', '');
    return { project, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  // Fallback: central Budget-Bidding Database list (pre-migration projects).
  console.warn(
    `[bidding/project] No "02. Bidding" list found in folder "${targetName}" (id=${targetFolder.id}). ` +
      `Falling back to central list ${CLICKUP.BUDGET_BIDDING_DB_LIST_ID}.`,
  );
  const allTradeTasks = await getTasksInList(CLICKUP.BUDGET_BIDDING_DB_LIST_ID, true);
  const projectTrades = allTradeTasks.filter(
    (task) => getFieldText(task, F.PROJECT_ID) === targetName,
  );
  const project = transformBiddingTasks(projectTrades, targetName, '', targetName, '', '');
  return { project, portfolioProjects, syncedAt: Date.now(), source: 'live' };
}

// Cache keyed on projectId — each project gets its own 60 s TTL entry.
const getCachedPayload = unstable_cache(buildPayload, ['lib-bidding-project:v5'], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [BIDDING_CACHE_TAG],
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const projectId = decodeURIComponent(id);
    const payload = await getCachedPayload(projectId);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, source: 'error' as const }, { status: 500 });
  }
}
