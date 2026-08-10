import { CLICKUP } from './constants';
import { ACCESS_PARAM } from './access';

/** The access token this page was opened with, if any. */
export function accessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(ACCESS_PARAM);
}

/**
 * Append the caller's access token to a URL or path.
 *
 * The gate also drops a cookie, but the ClickUp embed is a third-party iframe and
 * browsers increasingly refuse cookies there — so the token in the address bar is
 * the reliable carrier. Anything that navigates within the dashboard, or links
 * back into it, has to carry the token forward or the destination 401s.
 */
export function withAccessToken(url: string, token: string | null = accessToken()): string {
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${ACCESS_PARAM}=${encodeURIComponent(token)}`;
}

/**
 * Carry the caller's access token onto an API request. Every client-side call to
 * /api must go through this or it will 401 inside the widget.
 */
export function apiUrl(path: string): string {
  return withAccessToken(path);
}

/** Strip the access token from a URL — for anything that will be seen by someone
 *  who should not inherit the caller's access, e.g. a printed page. */
export function withoutAccessToken(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete(ACCESS_PARAM);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Mint an owner-safe link to one project's budget.
 *
 * The link a team member is looking at carries the team token, which opens every
 * project and every dashboard — it must never be pasted to an owner. This asks
 * the server for a share token instead: read-only, that one project, revocable by
 * rotating DASHBOARD_SHARE_SECRET. Team access is required to mint one, so a
 * share viewer calling this gets a 403; they already hold an owner link of their
 * own and should send that.
 */
export async function mintOwnerLink(
  projectId: string,
  view: 'budget' | 'report' = 'report',
): Promise<string> {
  const res = await fetch(
    apiUrl(`/api/share-link?projectId=${encodeURIComponent(projectId)}&view=${view}`),
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? `Could not create a share link (${res.status})`);
  }
  return body.url as string;
}

export function taskUrl(taskId: string): string {
  return `${CLICKUP.BASE_URL}/t/${taskId}`;
}

export function folderUrl(folderId: string): string {
  return `${CLICKUP.BASE_URL}/${CLICKUP.WORKSPACE_ID}/v/o/f/${folderId}`;
}

export function listUrl(listId: string): string {
  return `${CLICKUP.BASE_URL}/${CLICKUP.WORKSPACE_ID}/v/li/${listId}`;
}

// Every project's filing-set folder lives at a predictable SharePoint path:
//   /Shared Documents/01_ACTIVE_PROJECTS/{ProjectName}/04. Plans/01. Filing Set
// The viewid + FolderCTID are constant — they identify the Shared Documents
// library + folder content type, not a per-folder identifier.
const SHAREPOINT_BASE =
  'https://leaditbuilders.sharepoint.com/sites/LeaditBuilders/Shared%20Documents/Forms/AllItems.aspx';
const SHAREPOINT_VIEW_ID = '4f7af8a6-9a85-4292-8689-aa087cf3b013';
const SHAREPOINT_FOLDER_CTID = '0x012000940B1C2938494C48B241F654C2B73FEC';

export function filingSetUrl(projectFolderName: string): string {
  const idPath = `/sites/LeaditBuilders/Shared Documents/01_ACTIVE_PROJECTS/${projectFolderName}/04. Plans/01. Filing Set`;
  return `${SHAREPOINT_BASE}?id=${encodeURIComponent(idPath)}&viewid=${SHAREPOINT_VIEW_ID}&FolderCTID=${SHAREPOINT_FOLDER_CTID}`;
}

export function planFilingSetUrl(projectFolderName: string, planName: string): string {
  const idPath = `/sites/LeaditBuilders/Shared Documents/01_ACTIVE_PROJECTS/${projectFolderName}/04. Plans/01. Filing Set/${planName}`;
  return `${SHAREPOINT_BASE}?id=${encodeURIComponent(idPath)}&viewid=${SHAREPOINT_VIEW_ID}&FolderCTID=${SHAREPOINT_FOLDER_CTID}`;
}

export function planFieldSetUrl(projectFolderName: string, planName: string): string {
  const idPath = `/sites/LeaditBuilders/Shared Documents/01_ACTIVE_PROJECTS/${projectFolderName}/04. Plans/02. Field Set/${planName}`;
  return `${SHAREPOINT_BASE}?id=${encodeURIComponent(idPath)}&viewid=${SHAREPOINT_VIEW_ID}&FolderCTID=${SHAREPOINT_FOLDER_CTID}`;
}

export function permitsSearchUrl(permitsListIds: string[]): string {
  if (permitsListIds.length === 0) {
    return `${CLICKUP.BASE_URL}/${CLICKUP.WORKSPACE_ID}/v/s/everything`;
  }
  const params = permitsListIds
    .map((id) => `filters[][listIds][]=${encodeURIComponent(id)}`)
    .join('&');
  return `${CLICKUP.BASE_URL}/${CLICKUP.WORKSPACE_ID}/v/s/everything?${params}`;
}
