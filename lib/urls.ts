import { CLICKUP } from './constants';

export function taskUrl(taskId: string): string {
  return `${CLICKUP.BASE_URL}/t/${taskId}`;
}

export function folderUrl(folderId: string): string {
  return `${CLICKUP.BASE_URL}/${CLICKUP.WORKSPACE_ID}/v/o/f/${folderId}`;
}

export function listUrl(listId: string): string {
  return `${CLICKUP.BASE_URL}/${CLICKUP.WORKSPACE_ID}/v/li/${listId}`;
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
