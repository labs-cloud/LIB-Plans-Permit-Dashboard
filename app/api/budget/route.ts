import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getTasksInList } from '@/lib/clickup';
import { transformBudgetTasks } from '@/lib/budget-transforms';
import type { BudgetPayload, BudgetProject, BudgetPortfolioStub } from '@/lib/budget-types';
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

function getFieldText(task: { custom_fields?: Array<{ id: string; value?: unknown }> }, fieldId: string): string | null {
  const f = task.custom_fields?.find(cf => cf.id === fieldId);
  if (!f || f.value == null) return null;
  return typeof f.value === 'string' ? f.value.trim() || null : null;
}

async function buildBudgetPayload(projectId: string | null): Promise<BudgetPayload> {
  if (!hasClickUpToken()) {
    return {
      project: EMPTY_PROJECT,
      portfolioProjects: [],
      syncedAt: 0,
      source: 'empty',
      warning: 'CLICKUP_API_TOKEN is not set. Add it to .env.local to load live data.',
    };
  }

  // Fetch portfolio (Master Projects Board) and all trade rows (Budget-Bidding Database) in parallel.
  // includeClosed=true so AWARDED (completed) trade tasks are included.
  const [portfolioTasks, allTradeTasks] = await Promise.all([
    getTasksInList(CLICKUP.MASTER_PROJECTS_BOARD_LIST_ID),
    getTasksInList(CLICKUP.BUDGET_BIDDING_DB_LIST_ID, true),
  ]);

  // Only surface projects that actually have rows in the Budget-Bidding Database.
  const projectsWithData = new Set(
    allTradeTasks
      .map(task => getFieldText(task, F.PROJECT_ID))
      .filter((name): name is string => name !== null),
  );

  const portfolioProjects: BudgetPortfolioStub[] = portfolioTasks
    .filter(t => projectsWithData.has(t.name))
    .map(t => ({
      name: t.name,
      loc: '',
      real: true,
    }));

  // Resolve the target project name from the query param, defaulting to the first portfolio entry.
  const targetName = projectId
    ? (portfolioTasks.find(t => t.name === projectId)?.name ?? portfolioTasks[0]?.name)
    : portfolioTasks[0]?.name;

  if (!targetName) {
    return { project: EMPTY_PROJECT, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  // Filter Budget-Bidding Database rows for this project via the Project ID short-text field.
  const projectTrades = allTradeTasks.filter(task =>
    getFieldText(task, F.PROJECT_ID) === targetName,
  );

  const project = transformBudgetTasks(projectTrades, targetName, '', targetName, '', '');

  return { project, portfolioProjects, syncedAt: Date.now(), source: 'live' };
}

// Cache keyed on projectId so each project gets its own 60s TTL entry.
const getCachedBudgetPayload = unstable_cache(
  buildBudgetPayload,
  ['lib-budget:v3'],
  { revalidate: CACHE_TTL_SECONDS, tags: [BUDGET_CACHE_TAG] },
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const payload = await getCachedBudgetPayload(projectId);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, source: 'error' as const }, { status: 500 });
  }
}
