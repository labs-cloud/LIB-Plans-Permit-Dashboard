import { CLICKUP } from './constants';
import { ACCESS_PARAM } from './access';

/**
 * Carry the caller's access token from the page URL onto an API request.
 *
 * The gate also drops a cookie, but the ClickUp embed is a third-party iframe and
 * browsers increasingly refuse cookies there — so the token in the address bar is
 * the reliable carrier. Every client-side call to /api must go through this or it
 * will 401 inside the widget.
 */
export function apiUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  const token = new URLSearchParams(window.location.search).get(ACCESS_PARAM);
  if (!token) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${ACCESS_PARAM}=${encodeURIComponent(token)}`;
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
