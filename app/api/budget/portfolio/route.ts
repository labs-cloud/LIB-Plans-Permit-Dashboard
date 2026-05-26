import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getTasksInList } from '@/lib/clickup';
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

  // Fetch all portfolio tasks from the Master Projects Board and all trade rows
  // from the central Budget-Bidding Database list in parallel.
  const [portfolioTasks, allTradeTasks] = await Promise.all([
    getTasksInList(CLICKUP.MASTER_PROJECTS_BOARD_LIST_ID),
    getTasksInList(CLICKUP.BUDGET_BIDDING_DB_LIST_ID, true),
  ]);

  if (portfolioTasks.length === 0) {
    return { projects: [], syncedAt: Date.now(), source: 'live' };
  }

  // For each portfolio project, filter trade rows by Project ID field and transform.
  const results = await Promise.allSettled(
    portfolioTasks.map(async (task): Promise<BudgetProject> => {
      const name = task.name;
      const projectTrades = allTradeTasks.filter(
        (t) => getFieldText(t, F.PROJECT_ID) === name,
      );
      return transformBudgetTasks(projectTrades, name, '', name, '', '');
    }),
  );

  const projects: BudgetProject[] = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.error(
      `[budget/portfolio] Failed to process project "${portfolioTasks[i].name}":`,
      result.reason,
    );
    return { ...EMPTY_PROJECT, name: portfolioTasks[i].name };
  });

  return { projects, syncedAt: Date.now(), source: 'live' };
}

// Cache with a fixed key — no per-project variation — with 60 s TTL.
const getCachedPortfolioPayload = unstable_cache(
  buildPortfolioPayload,
  ['lib-budget-portfolio:v4'],
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
