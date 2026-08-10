import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_PARAM,
  SCOPE_HEADER,
  TEAM_SCOPE,
  resolveScope,
  type AccessScope,
} from '@/lib/access';

/**
 * Project id addressed by this path, or null when the path is not scoped to a
 * single project. Only budget routes are shareable — a share link is for showing
 * one owner one budget, so bidding, plans, permits and every cross-project route
 * stay team-only regardless of token.
 */
function projectIdForPath(pathname: string): string | null {
  const patterns = [
    /^\/budget\/([^/]+)(?:\/report)?\/?$/,
    /^\/api\/budget\/project\/([^/]+)\/?$/,
  ];
  for (const re of patterns) {
    const m = pathname.match(re);
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function deny(req: NextRequest, status: number, title: string, detail: string) {
  if (isApiPath(req.nextUrl.pathname)) {
    return NextResponse.json({ error: title, detail }, { status });
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:#f6f6f4; color:#1a1a1a; padding:24px; }
  @media (prefers-color-scheme: dark) { body { background:#111; color:#eee; } .card { background:#1b1b1b !important; border-color:#333 !important; } }
  .card { max-width:440px; background:#fff; border:1px solid #e4e4e0; border-radius:12px; padding:28px 30px; }
  h1 { margin:0 0 10px; font-size:17px; }
  p { margin:0; color:#666; font-size:13.5px; }
  @media (prefers-color-scheme: dark) { p { color:#aaa; } }
</style></head><body><div class="card"><h1>${title}</h1><p>${detail}</p></div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function allow(req: NextRequest, scope: AccessScope, presentedToken: string, fromQuery: boolean) {
  const headers = new Headers(req.headers);
  headers.set(SCOPE_HEADER, scope.kind === 'team' ? TEAM_SCOPE : scope.projectId);

  const res = NextResponse.next({ request: { headers } });

  // Remember the token so in-app navigation and same-tab reloads keep working
  // without the query string. SameSite=None is required for the ClickUp iframe,
  // which is a third-party context. The token still travels in the URL as well,
  // so the dashboard keeps working even where third-party cookies are blocked.
  if (fromQuery) {
    res.cookies.set(ACCESS_COOKIE, presentedToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // Never let a shared page end up in a search index or a shared cache.
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  if (scope.kind !== 'team') res.headers.set('cache-control', 'private, no-store');

  return res;
}

export async function middleware(req: NextRequest) {
  const teamToken = process.env.DASHBOARD_ACCESS_TOKEN;
  const shareSecret = process.env.DASHBOARD_SHARE_SECRET;

  // Fail closed. If the gate is misconfigured the dashboard stays shut rather
  // than silently reverting to being open to the whole internet.
  if (!teamToken) {
    return deny(
      req,
      503,
      'Dashboard unavailable',
      'DASHBOARD_ACCESS_TOKEN is not configured on this deployment, so access cannot be verified.',
    );
  }

  const queryToken = req.nextUrl.searchParams.get(ACCESS_PARAM) ?? undefined;
  const cookieToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const projectId = projectIdForPath(req.nextUrl.pathname);

  // A token in the URL wins over the cookie, so a scoped link opened in a browser
  // that already holds a team cookie is still evaluated on its own merits.
  for (const [token, fromQuery] of [
    [queryToken, true],
    [cookieToken, false],
  ] as const) {
    if (!token) continue;
    const scope = await resolveScope(token, projectId, { teamToken, shareSecret });
    if (scope) return allow(req, scope, token, fromQuery);
  }

  return deny(
    req,
    401,
    'Access required',
    'This dashboard is private. Open it using the link you were given — if that link has stopped working, ask the Lead It Builders team for a new one.',
  );
}

export const config = {
  matcher: [
    // Everything except Next's static output, the icon routes and the brand
    // images. Those carry no project data, are needed to render the denial page
    // itself, and are fetched by printed reports and by the ClickUp iframe —
    // where a third-party cookie is often refused, so a gated logo just breaks.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|lib_brand/).*)',
  ],
};
