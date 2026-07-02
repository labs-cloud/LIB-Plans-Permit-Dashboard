import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { hasClickUpToken, getFoldersInSpace } from '@/lib/clickup';
import { auditAllProjects, type SyncAuditResult } from '@/lib/bidding-sync-audit';
import { CLICKUP, CACHE_TTL_SECONDS } from '@/lib/constants';
import { BIDDING_CACHE_TAG } from '@/lib/cache';

export const revalidate = 60;
export const runtime = 'nodejs';

// Read-only dry-run: scans every Active-Projects folder and reports bid tasks
// that should exist in "02. Bidding" (a sub selected in "01. Budget") but don't.
// Performs NO writes — repairs are done separately/manually in ClickUp.
async function buildAudit(): Promise<SyncAuditResult> {
  if (!hasClickUpToken()) {
    return {
      scannedAt: 0,
      projectsScanned: 0,
      affectedProjects: 0,
      totalGaps: 0,
      gaps: [],
      byProject: [],
    };
  }
  const folders = await getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID);
  return auditAllProjects(folders);
}

const getCachedAudit = unstable_cache(buildAudit, ['lib-bidding-sync-audit:v1'], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [BIDDING_CACHE_TAG],
});

export async function GET() {
  try {
    const audit = await getCachedAudit();
    return NextResponse.json(audit, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, source: 'error' as const }, { status: 500 });
  }
}
