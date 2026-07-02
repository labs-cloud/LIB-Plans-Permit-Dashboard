// Bidding sync audit — read-only detection of "missing bid task" gaps.
//
// When a subcontractor is selected in a project's "01. Budget" list (the
// `1. Subcontractors` labels field on a trade task), a matching bid task is
// expected in that project's "02. Bidding" list under the same trade. When the
// auto-generation didn't fire, the sub is missing from bidding. This module
// scans a project and reports every such gap. It performs NO writes.

import type { ClickUpTask, ClickUpList } from './clickup';
import { getListsInFolder, getTasksInList } from './clickup';
import { CLICKUP } from './constants';

const F = CLICKUP.FIELD;

export interface SyncGap {
  project: string;
  trade: string;
  sub: string;
}

export interface ProjectAudit {
  project: string;
  folderId: string;
  hasBudgetList: boolean;
  hasBiddingList: boolean;
  gapCount: number;
  gaps: SyncGap[];
  error?: string;
}

export interface SyncAuditResult {
  scannedAt: number;
  projectsScanned: number;
  affectedProjects: number;
  totalGaps: number;
  gaps: SyncGap[];
  byProject: ProjectAudit[];
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

function findList(lists: ClickUpList[], candidates: string[]): ClickUpList | undefined {
  for (const candidate of candidates) {
    const found = lists.find((l) => l.name.toLowerCase() === candidate);
    if (found) return found;
  }
  return undefined;
}

const findBudgetList = (lists: ClickUpList[]) =>
  findList(lists, ['01. budget', '01 budget', 'budget']);
const findBiddingList = (lists: ClickUpList[]) =>
  findList(lists, ['02. bidding', '02 bidding', 'bidding']);

// Resolve the `1. Subcontractors` labels field on a Budget trade task to the
// list of selected subcontractor display names.
function selectedSubs(task: ClickUpTask): string[] {
  const f = task.custom_fields?.find((cf) => cf.id === F.SUBCONTRACTORS);
  if (!f || f.value == null) return [];
  const raw = Array.isArray(f.value) ? f.value : [];
  const options = f.type_config?.options ?? [];
  const byId = new Map(options.map((o) => [o.id, o.name]));
  const out: string[] = [];
  for (const v of raw) {
    const name = byId.get(String(v));
    if (name && name.trim()) out.push(name.trim());
  }
  return out;
}

// Build trade → set of existing bid-sub names from a "02. Bidding" task list.
// Mirrors the two schemas handled by bidding-transforms (parent/subtask
// hierarchy vs flat "Bid" tasks with a Trade dropdown), but returns the full,
// uncapped set of sub names keyed by normalised trade name.
function existingSubsByTrade(tasks: ClickUpTask[]): Map<string, Set<string>> {
  const byTrade = new Map<string, Set<string>>();
  const add = (trade: string, sub: string) => {
    const key = norm(trade);
    if (!byTrade.has(key)) byTrade.set(key, new Set());
    if (sub.trim()) byTrade.get(key)!.add(norm(sub));
  };

  const listTaskIds = new Set(tasks.map((t) => t.id));
  const hasHierarchy = tasks.some((t) => t.parent != null && listTaskIds.has(t.parent));

  if (hasHierarchy) {
    const parentName = new Map<string, string>();
    for (const t of tasks) if (!t.parent) parentName.set(t.id, t.name.trim());
    // Register trades even if they have no subs yet.
    for (const name of parentName.values()) add(name, '');
    for (const t of tasks) {
      if (!t.parent) continue;
      const trade = parentName.get(t.parent);
      if (trade) add(trade, t.name.trim());
    }
  } else {
    for (const t of tasks) {
      const f = t.custom_fields?.find((cf) => cf.id === F.TRADE);
      let trade: string | null = null;
      if (f?.value != null) {
        const numVal = Number(f.value);
        const opts = (f.type_config?.options ?? []) as Array<{ name: string; orderindex: number }>;
        trade = opts.find((o) => o.orderindex === numVal)?.name ?? null;
      }
      if (trade) add(trade, t.name.trim());
    }
  }
  return byTrade;
}

// Audit a single project folder for missing bid tasks. Read-only.
export async function auditProjectSync(
  folder: { id: string; name: string },
): Promise<ProjectAudit> {
  const base: ProjectAudit = {
    project: folder.name,
    folderId: folder.id,
    hasBudgetList: false,
    hasBiddingList: false,
    gapCount: 0,
    gaps: [],
  };
  try {
    const lists = await getListsInFolder(folder.id);
    const budgetList = findBudgetList(lists);
    const biddingList = findBiddingList(lists);
    base.hasBudgetList = !!budgetList;
    base.hasBiddingList = !!biddingList;

    // No budget list → nothing drives bid generation; no gaps to report.
    if (!budgetList) return base;

    const budgetTasks = await getTasksInList(budgetList.id, true);
    const biddingTasks = biddingList
      ? await getTasksInList(biddingList.id, true, true)
      : [];
    const existing = existingSubsByTrade(biddingTasks);

    const gaps: SyncGap[] = [];
    for (const bt of budgetTasks) {
      const trade = bt.name.trim();
      const subs = selectedSubs(bt);
      if (subs.length === 0) continue;
      const have = existing.get(norm(trade)) ?? new Set<string>();
      for (const sub of subs) {
        if (!have.has(norm(sub))) {
          gaps.push({ project: folder.name, trade, sub });
        }
      }
    }
    base.gaps = gaps;
    base.gapCount = gaps.length;
    return base;
  } catch (err) {
    base.error = err instanceof Error ? err.message : 'Unknown error';
    return base;
  }
}

// Scan every folder in the Active Projects space. Read-only.
export async function auditAllProjects(
  folders: Array<{ id: string; name: string }>,
): Promise<SyncAuditResult> {
  const settled = await Promise.allSettled(folders.map((f) => auditProjectSync(f)));
  const byProject: ProjectAudit[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          project: folders[i].name,
          folderId: folders[i].id,
          hasBudgetList: false,
          hasBiddingList: false,
          gapCount: 0,
          gaps: [],
          error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
        },
  );
  const gaps = byProject.flatMap((p) => p.gaps);
  return {
    scannedAt: Date.now(),
    projectsScanned: byProject.length,
    affectedProjects: byProject.filter((p) => p.gapCount > 0).length,
    totalGaps: gaps.length,
    gaps,
    byProject,
  };
}
