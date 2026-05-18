import type { Plan, Project, StatusKey } from './types';
import { PLAN_STATUS_ORDER } from './status-map';

// The matrix column for a plan is just its ClickUp Plan Type name. If a plan
// has no Plan Type set, it doesn't show up in a matrix column (it still
// renders in the Detailed view via its task name).
export function planTypeToColumn(planType: string | null | undefined): string | null {
  if (!planType) return null;
  const trimmed = planType.trim();
  return trimmed.length ? trimmed : null;
}

// Distinct ClickUp "Asset Type" values (Filing Set / Field Set / Shop Drawing
// / Misc / …) discovered across all plans. Ordered the way ClickUp lists them
// — Filing Set first, then Field Set, Shop Drawing, Misc — with anything new
// appended alphabetically at the end.
const ASSET_TYPE_CANONICAL_ORDER = [
  'filing set',
  'field set',
  'shop drawing',
  'shop drawings',
  'misc',
  'miscellaneous',
];

function canonicalRank(name: string): number {
  const lower = name.toLowerCase().trim();
  const i = ASSET_TYPE_CANONICAL_ORDER.indexOf(lower);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export function computeAssetTypes(projects: Project[]): string[] {
  const set = new Set<string>();
  for (const project of projects) {
    for (const plan of project.plans) {
      if (plan.assetType) set.add(plan.assetType.trim());
    }
  }
  return Array.from(set)
    .filter(Boolean)
    .sort((a, b) => {
      const ra = canonicalRank(a);
      const rb = canonicalRank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
}

// For a project's plan list, collapse to one status per Plan Type column,
// preferring the more advanced status (AP > FI > WO > TF > TS) when multiple
// plans share a column. Used by both the server (transforms.ts) and the
// client (when re-deriving matrix data after a Asset Type filter).
export function buildMatrix(plans: Plan[]): Record<string, StatusKey> {
  const m: Record<string, StatusKey> = {};
  for (const p of plans) {
    if (!p.matrixColumn || !p.status) continue;
    const prev = m[p.matrixColumn];
    if (!prev || PLAN_STATUS_ORDER.indexOf(p.status) < PLAN_STATUS_ORDER.indexOf(prev)) {
      m[p.matrixColumn] = p.status;
    }
  }
  return m;
}

