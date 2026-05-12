import { COORDINATORS } from './constants';
import type { CoordinatorId } from './constants';
import type { ClickUpCustomFieldValue, ClickUpTask, ClickUpUser } from './clickup';

function coordIdFromEmail(email: string | undefined | null): CoordinatorId | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  for (const c of COORDINATORS) {
    if (lower === c.email.toLowerCase()) return c.id;
  }
  return null;
}

function readDropdownLabel(field: ClickUpCustomFieldValue): string | null {
  // ClickUp dropdown values can be:
  //  - the option id string
  //  - the option index number
  //  - an object with { id, name }
  if (field.value == null) return null;
  const options = field.type_config?.options ?? [];
  if (typeof field.value === 'string') {
    const match = options.find((o) => o.id === field.value);
    return match?.name ?? field.value;
  }
  if (typeof field.value === 'number') {
    const match = options[field.value];
    return match?.name ?? null;
  }
  if (typeof field.value === 'object') {
    const v = field.value as { id?: string; name?: string };
    if (v.name) return v.name;
    if (v.id) {
      const match = options.find((o) => o.id === v.id);
      return match?.name ?? null;
    }
  }
  return null;
}

/**
 * §5 derivation:
 *   1. `Project Coordinator` custom field on the Project Overview task → that name
 *   2. else first assignee whose email matches Faigy or Malky
 *   3. else 'unassigned'
 *
 * Project-overview tasks are accepted in priority order; the first match wins.
 */
export function deriveCoordinator(overviewTasks: ClickUpTask[]): CoordinatorId {
  // TODO(v2): swap to a real "Project Coordinator" dropdown custom field once
  // it's added on the 00. Project Overview task type — the loop below will
  // pick it up automatically.
  for (const t of overviewTasks) {
    const field = t.custom_fields?.find((f) =>
      f.name.toLowerCase().includes('project coordinator'),
    );
    if (field) {
      const label = readDropdownLabel(field);
      if (label) {
        const lower = label.toLowerCase();
        for (const c of COORDINATORS) {
          if (lower.includes(c.name.toLowerCase()) || lower.includes(c.id)) return c.id;
        }
      }
    }
  }

  for (const t of overviewTasks) {
    for (const u of t.assignees ?? []) {
      const id = coordIdFromEmail(u.email);
      if (id) return id;
    }
  }

  return 'unassigned';
}

export function findCoordinatorByEmail(users: ClickUpUser[]): CoordinatorId {
  for (const u of users) {
    const id = coordIdFromEmail(u.email);
    if (id) return id;
  }
  return 'unassigned';
}
