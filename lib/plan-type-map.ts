import type { Project } from './types';

// The matrix column for a plan is just its ClickUp Plan Type name. If a plan
// has no Plan Type set, it doesn't show up in a matrix column (it still
// renders in the Detailed view via its task name).
export function planTypeToColumn(planType: string | null | undefined): string | null {
  if (!planType) return null;
  const trimmed = planType.trim();
  return trimmed.length ? trimmed : null;
}

// Build the matrix column list across every project, ordered by frequency
// (most-used plan types first) with alphabetical tie-break.
export function computeMatrixColumns(projects: Project[]): string[] {
  const counts = new Map<string, number>();
  for (const project of projects) {
    for (const plan of project.plans) {
      if (!plan.matrixColumn) continue;
      counts.set(plan.matrixColumn, (counts.get(plan.matrixColumn) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}
