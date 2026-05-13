import { COORDINATORS } from './constants';
import type { CoordinatorId } from './constants';
import type { ClickUpCustomFieldValue, ClickUpTask, ClickUpUser } from './clickup';

// Per-coordinator matcher haystack: lowercase tokens we'll substring-match
// against any email / username / initials / dropdown value we encounter.
const MATCHERS: Record<CoordinatorId, string[]> = {
  faigy: ['faigy', 'follman', 'faigy follman', 'ff'],
  malky: ['malky', 'kahan', 'malky kahan', 'mk'],
  unassigned: [],
};

function matchesAny(text: string | null | undefined, tokens: string[]): boolean {
  if (!text) return false;
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  return tokens.some((tok) => lower.includes(tok));
}

function nameMatchesCoordinator(text: string | null | undefined): CoordinatorId | null {
  for (const c of COORDINATORS) {
    if (matchesAny(text, MATCHERS[c.id])) return c.id;
  }
  return null;
}

function coordIdFromUser(user: ClickUpUser): CoordinatorId | null {
  // Check email (strictest signal) first, then username, then initials.
  return (
    nameMatchesCoordinator(user.email ?? null) ??
    nameMatchesCoordinator(user.username ?? null) ??
    nameMatchesCoordinator(user.initials ?? null)
  );
}

function readDropdownLabel(field: ClickUpCustomFieldValue): string | null {
  if (field.value == null) return null;
  const options = field.type_config?.options ?? [];
  if (typeof field.value === 'string') {
    return options.find((o) => o.id === field.value)?.name ?? field.value;
  }
  if (typeof field.value === 'number') {
    return options[field.value]?.name ?? null;
  }
  if (typeof field.value === 'object') {
    const v = field.value as { id?: string; name?: string };
    if (v.name) return v.name;
    if (v.id) return options.find((o) => o.id === v.id)?.name ?? null;
  }
  return null;
}

/**
 * §5 derivation, broadened for v1.1:
 *   1. `Project Coordinator` custom field on ANY task in the project →
 *      run the dropdown value through nameMatchesCoordinator.
 *   2. Otherwise tally hits across every assignee on every task (overview +
 *      plans + permits) using email / username / initials → take the highest.
 *   3. Tie-break in COORDINATORS order (Faigy beats Malky), then 'unassigned'.
 *
 * The Project Overview task may legitimately have no assignees, so we cast a
 * wide net rather than fall through to "Unassigned" the moment §5.1/§5.2 fail.
 */
export function deriveCoordinator(tasks: ClickUpTask[]): CoordinatorId {
  // TODO(v2): when the canonical "Project Coordinator" dropdown lands on the
  // 00. Project Overview task type, the loop below picks it up automatically.
  for (const t of tasks) {
    const field = t.custom_fields?.find((f) =>
      f.name.toLowerCase().includes('project coordinator'),
    );
    if (!field) continue;
    const label = readDropdownLabel(field);
    const match = nameMatchesCoordinator(label);
    if (match) return match;
  }

  const tally: Record<CoordinatorId, number> = { faigy: 0, malky: 0, unassigned: 0 };
  for (const t of tasks) {
    for (const u of t.assignees ?? []) {
      const id = coordIdFromUser(u);
      if (id) tally[id] += 1;
    }
  }

  let best: CoordinatorId = 'unassigned';
  let bestScore = 0;
  for (const c of COORDINATORS) {
    if (tally[c.id] > bestScore) {
      best = c.id;
      bestScore = tally[c.id];
    }
  }
  return best;
}

export function findCoordinatorByEmail(users: ClickUpUser[]): CoordinatorId {
  for (const u of users) {
    const id = coordIdFromUser(u);
    if (id) return id;
  }
  return 'unassigned';
}
