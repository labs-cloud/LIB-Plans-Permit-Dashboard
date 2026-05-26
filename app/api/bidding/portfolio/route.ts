import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getListsInFolder, getTasksInList } from '@/lib/clickup';
import { transformBiddingTasks, transformBiddingTasksByName } from '@/lib/bidding-transforms';
import type { BiddingPortfolioPayload, BiddingProject } from '@/lib/bidding-types';
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

function getFieldText(task: { custom_fields?: Array<{ id: string; value?: unknown }> }, fieldId: string): string | null {
  const f = task.custom_fields?.find(cf => cf.id === fieldId);
  if (!f || f.value == null) return null;
  return typeof f.value === 'string' ? f.value.trim() || null : null;
}

// Finds the "02. Bidding" list within a folder's lists.
// Accepts "02. Bidding", "02 Bidding", or bare "Bidding" (case-insensitive).
function findBiddingList(lists: ClickUpList[]): ClickUpList | undefined {
  const candidates = ['02. bidding', '02 bidding', 'bidding'];
  for (const candidate of candidates) {
    const found = lists.find(l => l.name.toLowerCase() === candidate);
    if (found) return found;
  }
  return undefined;
}

async function buildPortfolioPayload(): Promise<BiddingPortfolioPayload> {
  if (!hasClickUpToken()) {
    return {
      projects: [],
      syncedAt: 0,
      source: 'empty',
    };
  }

  // Fetch all project folders from the Active Projects space.
  const folders = await getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID);

  // Take the first 8 folders for the portfolio matrix.
  const targetFolders = folders.slice(0, 8);

  if (targetFolders.length === 0) {
    return { projects: [], syncedAt: Date.now(), source: 'live' };
  }

  // Fetch each project's bidding data in parallel; failed projects get an empty stub.
  const results = await Promise.allSettled(
    targetFolders.map(async (folder): Promise<BiddingProject> => {
      const folderName = folder.name;
      const lists = await getListsInFolder(folder.id);
      const biddingList = findBiddingList(lists);

      if (biddingList) {
        // Per-project path: field IDs vary per list, so look up by field name.
        const tasks = await getTasksInList(biddingList.id, true);
        return transformBiddingTasksByName(tasks, folderName, '', folderName, '', '');
      }

      // Fallback: read from the central Budget-Bidding Database list.
      console.warn(
        `[bidding/portfolio] No "02. Bidding" list found in folder "${folderName}" (id=${folder.id}). ` +
        `Falling back to central list ${CLICKUP.BUDGET_BIDDING_DB_LIST_ID}.`,
      );
      const allTradeTasks = await getTasksInList(CLICKUP.BUDGET_BIDDING_DB_LIST_ID, true);
      const projectTrades = allTradeTasks.filter(task =>
        getFieldText(task, F.PROJECT_ID) === folderName,
      );
      return transformBiddingTasks(projectTrades, folderName, '', folderName, '', '');
    }),
  );

  const projects: BiddingProject[] = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.error(
      `[bidding/portfolio] Failed to fetch project "${targetFolders[i].name}":`,
      result.reason,
    );
    return { ...EMPTY_PROJECT, name: targetFolders[i].name };
  });

  return { projects, syncedAt: Date.now(), source: 'live' };
}

// Cache keyed on a fixed key (no per-project variation) with 60 s TTL.
const getCachedPortfolioPayload = unstable_cache(
  buildPortfolioPayload,
  ['lib-bidding-portfolio:v4'],
  { revalidate: CACHE_TTL_SECONDS, tags: [BIDDING_CACHE_TAG] },
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
