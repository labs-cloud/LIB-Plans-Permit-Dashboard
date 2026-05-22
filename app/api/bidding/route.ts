import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace, getListsInFolder, getTasksInList } from '@/lib/clickup';
import { transformBiddingTasks } from '@/lib/bidding-transforms';
import type { BiddingPayload, BiddingProject, PortfolioProjectStub } from '@/lib/bidding-types';
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

async function buildBiddingPayload(folderId: string | null): Promise<BiddingPayload> {
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

  const portfolioProjects: PortfolioProjectStub[] = folders.map(f => ({
    name: f.name,
    location: '',
    isReal: true,
  }));

  const targetFolder = folderId
    ? folders.find(f => f.id === folderId) ?? folders[0]
    : folders[0];

  if (!targetFolder) {
    return { project: EMPTY_PROJECT, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  // Find a Bidding list within the project folder
  let lists;
  try {
    lists = await getListsInFolder(targetFolder.id);
  } catch {
    return { project: { ...EMPTY_PROJECT, name: targetFolder.name }, portfolioProjects, syncedAt: Date.now(), source: 'live' };
  }

  const biddingList = lists.find(l =>
    (CLICKUP.BIDDING_LIST_NAMES as readonly string[]).some(
      name => l.name.toLowerCase().trim() === name.toLowerCase().trim(),
    ),
  );

  if (!biddingList) {
    return {
      project: { ...EMPTY_PROJECT, name: targetFolder.name, id: targetFolder.id },
      portfolioProjects,
      syncedAt: Date.now(),
      source: 'live',
    };
  }

  const tasks = await getTasksInList(biddingList.id);
  const project = transformBiddingTasks(tasks, targetFolder.name, '', targetFolder.id, '', '');

  return { project, portfolioProjects, syncedAt: Date.now(), source: 'live' };
}

// Cache per folderId so each project gets its own 60s TTL entry
const getCachedBiddingPayload = unstable_cache(
  buildBiddingPayload,
  ['lib-bidding:v1'],
  { revalidate: CACHE_TTL_SECONDS, tags: [BIDDING_CACHE_TAG] },
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    const payload = await getCachedBiddingPayload(folderId);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, source: 'error' as const }, { status: 500 });
  }
}
