import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getListsInFolder, getTasksInList } from '@/lib/clickup';
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

async function buildBudgetPayload(folderId: string | null): Promise<BudgetPayload> {
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

  const targetFolder = folderId
    ? folders.find(f => f.id === folderId) ?? folders[0]
    : folders[0];

  if (!targetFolder) {
    return { project: EMPTY_PROJECT, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  // Find a Budget list within the project folder
  let lists;
  try {
    lists = await getListsInFolder(targetFolder.id);
  } catch {
    return { project: { ...EMPTY_PROJECT, name: targetFolder.name }, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  const budgetList = lists.find(l =>
    (CLICKUP.BUDGET_LIST_NAMES as readonly string[]).some(
      name => l.name.toLowerCase().trim() === name.toLowerCase().trim(),
    ),
  );

  if (!budgetList) {
    return {
      project: { ...EMPTY_PROJECT, name: targetFolder.name, id: targetFolder.id },
      portfolioProjects,
      syncedAt: Date.now(),
      source: 'live',
    };
  }

  const tasks = await getTasksInList(budgetList.id);
  const project = transformBudgetTasks(tasks, targetFolder.name, '', targetFolder.id, '', '');

  return { project, portfolioProjects, syncedAt: Date.now(), source: 'live' };
}

// Cache per folderId so each project gets its own 60s TTL entry
const getCachedBudgetPayload = unstable_cache(
  buildBudgetPayload,
  ['lib-budget:v1'],
  { revalidate: CACHE_TTL_SECONDS, tags: [BUDGET_CACHE_TAG] },
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    const payload = await getCachedBudgetPayload(folderId);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, source: 'error' as const }, { status: 500 });
  }
}
