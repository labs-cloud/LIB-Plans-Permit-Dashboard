// Minimal ClickUp REST client. Personal token in `Authorization` header
// (raw, no `Bearer` prefix — ClickUp's quirk).

const API_BASE = 'https://api.clickup.com/api/v2';

export interface ClickUpFolder {
  id: string;
  name: string;
  archived?: boolean;
  hidden?: boolean;
}

export interface ClickUpList {
  id: string;
  name: string;
  archived?: boolean;
  folder?: { id: string; name: string };
}

export interface ClickUpUser {
  id: number;
  username?: string;
  email?: string;
  initials?: string;
  color?: string;
  profilePicture?: string | null;
}

export interface ClickUpDropdownOption {
  id: string;
  name: string;
  orderindex?: number;
  color?: string | null;
}

export interface ClickUpCustomFieldValue {
  id: string;
  name: string;
  type: string;
  type_config?: { options?: ClickUpDropdownOption[] };
  value?: unknown;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string; color?: string; type?: string };
  date_created?: string | null;
  date_updated?: string | null;
  date_closed?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  assignees?: ClickUpUser[];
  list?: { id: string; name: string };
  folder?: { id: string; name: string };
  custom_fields?: ClickUpCustomFieldValue[];
  url?: string;
}

function getToken(): string {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error('CLICKUP_API_TOKEN is not set');
  return token;
}

async function clickupFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: getToken(),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    // Server-side only. Next.js caches at the route level via unstable_cache.
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ClickUp ${path} → ${res.status} ${res.statusText} ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

export function hasClickUpToken(): boolean {
  return !!process.env.CLICKUP_API_TOKEN;
}

export async function getFoldersInSpace(spaceId: string): Promise<ClickUpFolder[]> {
  const data = await clickupFetch<{ folders: ClickUpFolder[] }>(
    `/space/${spaceId}/folder?archived=false`,
  );
  return data.folders.filter((f) => !f.archived && !f.hidden);
}

export async function getListsInFolder(folderId: string): Promise<ClickUpList[]> {
  const data = await clickupFetch<{ lists: ClickUpList[] }>(
    `/folder/${folderId}/list?archived=false`,
  );
  return data.lists.filter((l) => !l.archived);
}

// Fetches a single task by ID. Use this when the list-task endpoint omits
// values for a custom field (a known ClickUp quirk) — /task/{id} always
// returns the full custom_fields with their values.
export async function getTask(taskId: string): Promise<ClickUpTask> {
  return clickupFetch<ClickUpTask>(`/task/${encodeURIComponent(taskId)}`);
}

export async function getTasksInList(listId: string): Promise<ClickUpTask[]> {
  const out: ClickUpTask[] = [];
  let page = 0;
  while (true) {
    // include_closed=false: skip archived
    // subtasks=false: every Plan is a discrete task; including subtasks via
    //   the list endpoint has been observed to drop custom-field VALUES
    //   (e.g. Asset Type comes back with value: null even when set in UI).
    const data = await clickupFetch<{ tasks: ClickUpTask[]; last_page?: boolean }>(
      `/list/${listId}/task?subtasks=false&include_closed=false&page=${page}`,
    );
    out.push(...data.tasks);
    if (!data.tasks.length || data.last_page || data.tasks.length < 100) break;
    page += 1;
    if (page > 20) break; // safety belt — 2000 tasks per list is far beyond expected scale
  }
  return out;
}
