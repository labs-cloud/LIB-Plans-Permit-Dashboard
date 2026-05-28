import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getListsInFolder, getTasksInList } from '@/lib/clickup';
import { transformBudgetTasks } from '@/lib/budget-transforms';
import { findBiddingList, computeBiddingLows, computeAwardedBids } from '@/lib/bidding-lows';
import type { BudgetPayload, BudgetProject, BudgetPortfolioStub } from '@/lib/budget-types';
import type { ClickUpList } from '@/lib/clickup';
import { CLICKUP, CACHE_TTL_SECONDS } from '@/lib/constants';
import { BUDGET_CACHE_TAG } from '@/lib/cache';

export const revalidate = 60;
export const runtime = 'nodejs';

const EMPTY_PROJECT: BudgetProject = {
  name: '—',
  location: '—',
  id: '—',
  phase: 'Budgeting',
  coordInitials: '—',
  coordName: '—',
  trades: [],
};

function findBudgetList(lists: ClickUpList[]): ClickUpList | undefined {
  const candidates = ['01. budget', '01 budget', 'budget'];
  for (const candidate of candidates) {
    const found = lists.find(l => l.name.toLowerCase() === candidate);
    if (found) return found;
  }
  return undefined;
}

async function buildPayload(projectId: string): Promise<BudgetPayload> {
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

  const portfolioProjects: BudgetPortfolioStub[] = folders.map(f => ({
    name: f.name,
    loc: '',
    real: true,
  }));

  const targetFolder = folders.find(f => f.name === projectId) ?? folders[0];

  if (!targetFolder) {
    return { project: EMPTY_PROJECT, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  const lists = await getListsInFolder(targetFolder.id);
  const budgetList = findBudgetList(lists);
  const biddingListInFolder = findBiddingList(lists);

  if (!budgetList) {
    console.warn(
      `[budget/project] No "01. Budget" list in folder "${targetFolder.name}" (id=${targetFolder.id}).`,
    );
    return {
      project: { ...EMPTY_PROJECT, name: targetFolder.name },
      portfolioProjects,
      syncedAt: Date.now(),
      source: 'live',
    };
  }

  const [tasks, biddingTasks] = await Promise.all([
    getTasksInList(budgetList.id, true),
    biddingListInFolder ? getTasksInList(biddingListInFolder.id, true, true) : Promise.resolve([]),
  ]);
  const biddingLows = computeBiddingLows(biddingTasks);
  const awardedBids = computeAwardedBids(biddingTasks);
  const project = transformBudgetTasks(tasks, targetFolder.name, '', targetFolder.id, '', '', biddingLows, awardedBids);

  return { project, portfolioProjects, syncedAt: Date.now(), source: 'live' };
}

const getCachedPayload = unstable_cache(buildPayload, ['lib-budget-project:v11'], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [BUDGET_CACHE_TAG],
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
