import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getTasksInList } from '@/lib/clickup';
import { transformBudgetTasks } from '@/lib/budget-transforms';
import type { BudgetPortfolioPayload, BudgetProject } from '@/lib/budget-types';
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

const F = CLICKUP.FIELD;

function getFieldText(
  task: { custom_fields?: Array<{ id: string; value?: unknown }> },
  fieldId: string,
): string | null {
  const f = task.custom_fields?.find((cf) => cf.id === fieldId);
  if (!f || f.value == null) return null;
  return typeof f.value === 'string' ? f.value.trim() || null : null;
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

  // Use project folders from the Active Projects space — same source as the bidding
  // portfolio. Folder names match the PROJECT_ID short-text field on trade tasks.
  // The Master Projects Board has duplicate entries so we do NOT use it here.
  const [folders, allTradeTasks] = await Promise.all([
    getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID),
    getTasksInList(CLICKUP.BUDGET_BIDDING_DB_LIST_ID, true),
  ]);

  if (folders.length === 0) {
    return { projects: [], syncedAt: Date.now(), source: 'live' };
  }

  // For each project folder, filter trade rows by Project ID field and transform.
  const results = await Promise.allSettled(
    folders.map(async (folder): Promise<BudgetProject> => {
      const name = folder.name;
      const projectTrades = allTradeTasks.filter(
        (t) => getFieldText(t, F.PROJECT_ID) === name,
      );
      return transformBudgetTasks(projectTrades, name, '', folder.id, '', '');
    }),
  );

  const projects: BudgetProject[] = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.error(
      `[budget/portfolio] Failed to process project "${folders[i].name}":`,
      result.reason,
    );
    return { ...EMPTY_PROJECT, name: folders[i].name };
  });

  return { projects, syncedAt: Date.now(), source: 'live' };
}

// Cache with a fixed key — no per-project variation — with 60 s TTL.
const getCachedPortfolioPayload = unstable_cache(
  buildPortfolioPayload,
  ['lib-budget-portfolio:v5'],
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
