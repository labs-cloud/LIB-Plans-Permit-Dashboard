import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { SCOPE_HEADER, TEAM_SCOPE, projectShareToken } from '@/lib/access';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Mint a single-project share link for an owner or other outside party.
 *
 * Reachable only with the team token: the access gate resolves share tokens
 * against the project named in the path, and this path names none, so a share
 * token can never be used to mint another one.
 *
 *   GET /api/share-link?projectId=257%20E%20201%20St&k=<team token>
 *
 * `view=report` returns the printable outlook report instead of the interactive
 * budget page. Both live under /budget/<projectId>, which is exactly what the
 * share token opens.
 */
export async function GET(req: Request) {
  const scope = (await headers()).get(SCOPE_HEADER);
  if (scope !== TEAM_SCOPE) {
    return NextResponse.json({ error: 'Team access required' }, { status: 403 });
  }

  const secret = process.env.DASHBOARD_SHARE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'DASHBOARD_SHARE_SECRET is not configured on this deployment' },
      { status: 503 },
    );
  }

  const params = new URL(req.url).searchParams;
  const projectId = params.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  const view = params.get('view') === 'report' ? '/report' : '';

  const token = await projectShareToken(secret, projectId);
  const url = `${SITE_URL}/budget/${encodeURIComponent(projectId)}${view}?k=${token}`;

  return NextResponse.json(
    {
      projectId,
      url,
      grants: 'Read-only access to this project\'s budget. No portfolio, no other projects.',
      revoke: 'Rotate DASHBOARD_SHARE_SECRET to invalidate every share link at once.',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
