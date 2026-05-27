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
  // Hierarchy fields — present on per-project Bidding list tasks.
  // parent: null on root tasks (Trade rows); set to parent task ID on subtasks (Sub rows).
  parent?: string | null;
  // task_type: "Trade" on parent tasks, "Contact" on subtask (sub) tasks.
  task_type?: string | null;
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
    // Per-endpoint cache so a partial failure doesn't blow away the whole
    // dashboard. Outer unstable_cache still wraps the aggregated payload.
    next: { revalidate: 60, tags: ['clickup'] },
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

// Update a single custom field on a task. Used by the budget reconcile endpoint
// to write the chosen value back to ClickUp's "Updated Budget" field.
export async function updateTaskCustomField(
  taskId: string,
  fieldId: string,
  value: number,
): Promise<void> {
  await clickupFetch<unknown>(
    `/task/${encodeURIComponent(taskId)}/field/${encodeURIComponent(fieldId)}`,
    { method: 'POST', body: JSON.stringify({ value }) },
  );
}

// includeSubtasks=true is required for per-project "02. Bidding" lists, which use a
// parent/subtask hierarchy: root tasks = Trade rows, subtasks = Sub rows. Without it
// only the Trade parent tasks are returned and all sub bid data is missing.
// When false (default), ClickUp custom-field VALUES are more reliably populated
// (there is a known ClickUp quirk where subtasks via list endpoint can drop values).
export async function getTasksInList(
  listId: string,
  includeClosed = false,
  includeSubtasks = false,
): Promise<ClickUpTask[]> {
  const out: ClickUpTask[] = [];
  let page = 0;
  const closedParam = includeClosed ? 'true' : 'false';
  const subtasksParam = includeSubtasks ? 'true' : 'false';
  while (true) {
    const data = await clickupFetch<{ tasks: ClickUpTask[]; last_page?: boolean }>(
      `/list/${listId}/task?subtasks=${subtasksParam}&include_closed=${closedParam}&page=${page}`,
    );
    out.push(...data.tasks);
    if (!data.tasks.length || data.last_page || data.tasks.length < 100) break;
    page += 1;
    if (page > 20) break; // safety belt — 2000 tasks per list is far beyond expected scale
  }
  return out;
}
