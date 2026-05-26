import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getTasksInList } from '@/lib/clickup';
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

  // Use project folders from the Active Projects space — folder names match the
  // PROJECT_ID short-text field on trade tasks. The Master Projects Board has
  // duplicate entries and its task names may differ from the PROJECT_ID field values.
  const [folders, allTradeTasks] = await Promise.all([
    getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID),
    getTasksInList(CLICKUP.BUDGET_BIDDING_DB_LIST_ID, true),
  ]);

  const portfolioProjects: BudgetPortfolioStub[] = folders.map(f => ({
    name: f.name,
    loc: '',
    real: true,
  }));

  // Resolve the target project name from the query param, defaulting to the first folder.
  const targetName = projectId
    ? (folders.find(f => f.name === projectId)?.name ?? folders[0]?.name)
    : folders[0]?.name;

  if (!targetName) {
    return { project: EMPTY_PROJECT, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  // Filter central Budget-Bidding Database rows for this project by the
  // PROJECT_ID short-text field, which stores the folder name.
  const projectTrades = allTradeTasks.filter(task =>
    getFieldText(task, F.PROJECT_ID) === targetName,
  );

  const project = transformBudgetTasks(projectTrades, targetName, '', targetName, '', '');

  return { project, portfolioProjects, syncedAt: Date.now(), source: 'live' };
}

// Cache keyed on projectId so each project gets its own 60s TTL entry.
const getCachedBudgetPayload = unstable_cache(
  buildBudgetPayload,
  ['lib-budget:v4'],
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
