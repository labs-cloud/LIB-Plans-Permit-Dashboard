import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getListsInFolder, getTasksInList } from '@/lib/clickup';
import { transformBudgetTasks } from '@/lib/budget-transforms';
import { findBiddingList, computeBiddingLows } from '@/lib/bidding-lows';
import type { BudgetPortfolioPayload, BudgetProject } from '@/lib/budget-types';
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

async function buildPortfolioPayload(): Promise<BudgetPortfolioPayload> {
  if (!hasClickUpToken()) {
    return {
      projects: [],
      syncedAt: 0,
      source: 'empty',
      warning: 'CLICKUP_API_TOKEN is not set. Add it to .env.local to load live data.',
    };
  }

  const folders = await getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID);

  if (folders.length === 0) {
    return { projects: [], syncedAt: Date.now(), source: 'live' };
  }

  // Phase 1: fetch lists for all folders in parallel.
  const folderListResults = await Promise.allSettled(
    folders.map(f => getListsInFolder(f.id)),
  );

  // Phase 2: for each folder, find "01. Budget" list and fetch its tasks in parallel.
  const projectResults = await Promise.allSettled(
    folders.map(async (folder, i): Promise<BudgetProject> => {
      const listsResult = folderListResults[i];
      if (listsResult.status !== 'fulfilled') {
        console.warn(
          `[budget/portfolio] Failed to get lists for "${folder.name}" (id=${folder.id}):`,
          listsResult.reason,
        );
        return { ...EMPTY_PROJECT, name: folder.name };
      }

      const budgetList = findBudgetList(listsResult.value);
      if (!budgetList) {
        console.warn(
          `[budget/portfolio] No "01. Budget" list in folder "${folder.name}" (id=${folder.id}).`,
        );
        return { ...EMPTY_PROJECT, name: folder.name };
      }

      const biddingListInFolder = findBiddingList(listsResult.value);
      const [tasks, biddingTasks] = await Promise.all([
        getTasksInList(budgetList.id, true),
        biddingListInFolder ? getTasksInList(biddingListInFolder.id, true, true) : Promise.resolve([]),
      ]);
      const biddingLows = computeBiddingLows(biddingTasks);
      return transformBudgetTasks(tasks, folder.name, '', folder.id, '', '', biddingLows);
    }),
  );

  const projects: BudgetProject[] = projectResults.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    console.error(
      `[budget/portfolio] Failed to process "${folders[i].name}":`,
      result.reason,
    );
    return { ...EMPTY_PROJECT, name: folders[i].name };
  });

  return { projects, syncedAt: Date.now(), source: 'live' };
}

const getCachedPortfolioPayload = unstable_cache(
  buildPortfolioPayload,
  ['lib-budget-portfolio:v6'],
  { revalidate: CACHE_TTL_SECONDS, tags: [BUDGET_CACHE_TAG] },
);

export async function GET() {
  try {
    const payload = await getCachedPortfolioPayload();
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, source: 'error' as const }, { status: 500 });
  }
}
