// Access control for the dashboard.
//
// The dashboard renders live commercial data — every project's budget, every
// subcontractor bid — and is embedded in ClickUp as a public iframe, so it has no
// session/login of its own. Access is therefore carried by a token, and there are
// exactly two kinds:
//
//   • The team token (DASHBOARD_ACCESS_TOKEN) — full access to everything.
//   • A project share token — read access to ONE project and nothing else. Handed
//     to an owner or other outside party so they can see their own job without
//     the portfolio, the project list, or anyone else's numbers.
//
// Share tokens are derived, not stored: HMAC(DASHBOARD_SHARE_SECRET, projectId).
// That keeps them stateless (no database, works on Edge), unguessable without the
// secret, and individually reproducible — while rotating the secret revokes every
// outstanding share link at once.
//
// Runs inside middleware, so this module must stay Edge-compatible: Web Crypto
// only, no Node built-ins.

/** Query parameter and cookie name carrying the token. */
export const ACCESS_PARAM = 'k';
export const ACCESS_COOKIE = 'lib_access';

/**
 * Header the gate stamps on the forwarded request so pages and route handlers know
 * what the caller may see: TEAM_SCOPE, or the single project id they are limited
 * to. Downstream code must treat any other value as restricted.
 */
export const SCOPE_HEADER = 'x-lib-scope';
export const TEAM_SCOPE = 'team';

const SHARE_PREFIX = 'p_';
const SHARE_LENGTH = 32;

export type AccessScope =
  /** Full access — the team token. */
  | { kind: 'team' }
  /** Read access limited to this one project. */
  | { kind: 'project'; projectId: string };

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64url(new Uint8Array(sig));
}

/**
 * Length-independent constant-time comparison, so a token can't be recovered by
 * timing how long a wrong guess takes to reject.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The share token for one project. Deterministic for a given secret. */
export async function projectShareToken(secret: string, projectId: string): Promise<string> {
  const digest = await hmac(secret, `project:${projectId}`);
  return SHARE_PREFIX + digest.slice(0, SHARE_LENGTH);
}

export function isShareToken(token: string): boolean {
  return token.startsWith(SHARE_PREFIX);
}

/**
 * Resolve a presented token against the project the request is actually for.
 *
 * `projectId` is the project named in the request path, or null when the path is
 * not project-scoped (the portfolio pages, the cross-project APIs). A share token
 * only ever resolves against its own project, so a path with no project — or a
 * different one — leaves it unresolved and the caller denies the request. That is
 * what stops a shared owner link from reaching the portfolio.
 */
export async function resolveScope(
  token: string | undefined,
  projectId: string | null,
  env: { teamToken?: string; shareSecret?: string },
): Promise<AccessScope | null> {
  if (!token) return null;

  if (env.teamToken && safeEqual(token, env.teamToken)) return { kind: 'team' };

  if (isShareToken(token) && env.shareSecret && projectId) {
    const expected = await projectShareToken(env.shareSecret, projectId);
    if (safeEqual(token, expected)) return { kind: 'project', projectId };
  }

  return null;
}
