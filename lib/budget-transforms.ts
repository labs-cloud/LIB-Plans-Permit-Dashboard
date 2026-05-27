import type { ClickUpCustomFieldValue, ClickUpTask } from './clickup';
import type { BudgetTrade, BudgetProject, MoneyVal } from './budget-types';
import { CLICKUP } from './constants';

const F = CLICKUP.FIELD;

function getFieldById(task: ClickUpTask, id: string): ClickUpCustomFieldValue | undefined {
  return task.custom_fields?.find(f => f.id === id);
}

function getCostType(task: ClickUpTask): 'hard' | 'soft' {
  const f = getFieldById(task, F.COST_TYPE);
  if (!f || f.value == null) return 'hard';
  const options = (f.type_config?.options ?? []) as Array<{ id: string; name: string; orderindex: number }>;
  const numVal = Number(f.value);
  const opt = Number.isFinite(numVal)
    ? options.find(o => o.orderindex === numVal)
    : options.find(o => o.id === String(f.value));
  return (opt?.name ?? '').toLowerCase().includes('soft') ? 'soft' : 'hard';
}

function getCurrency(task: ClickUpTask, id: string): number | null {
  const f = getFieldById(task, id);
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Auto-rule: if an Updated Budget override exists use it; otherwise carry-forward the estimate.
function deriveNewv(est: MoneyVal, fin: MoneyVal): MoneyVal {
  if (fin !== null && fin !== undefined) return fin;
  return est;
}

interface RawEntry {
  taskId: string;
  tradeName: string;
  est: MoneyVal;
  fin: MoneyVal;
  newv: MoneyVal;
  costType: 'hard' | 'soft';
  status: string;
  dateUpdated: string | null | undefined;
}

function taskUrl(taskId: string): string {
  return `${CLICKUP.BASE_URL}/t/${taskId}`;
}

// Dedup by (costType, tradeName): prefer non-zero Budget Allocated; tie-break by most-recent date_updated.
function dedup(entries: RawEntry[]): BudgetTrade[] {
  const groups = new Map<string, RawEntry[]>();
  for (const e of entries) {
    const key = `${e.costType}::${e.tradeName}`;
    let g = groups.get(key);
    if (!g) { g = []; groups.set(key, g); }
    g.push(e);
  }

  const result: BudgetTrade[] = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      const e = group[0];
      result.push({
        trade: e.tradeName,
        est: e.est,
        fin: e.fin,
        newv: e.newv,
        costType: e.costType,
        status: e.status,
        taskId: e.taskId,
      });
      continue;
    }

    // Sort: non-zero est first, then most-recently updated.
    const sorted = [...group].sort((a, b) => {
      const aHas = typeof a.est === 'number' && a.est > 0 ? 1 : 0;
      const bHas = typeof b.est === 'number' && b.est > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return Number(b.dateUpdated ?? 0) - Number(a.dateUpdated ?? 0);
    });

    const [winner, ...losers] = sorted;
    result.push({
      trade: winner.tradeName,
      est: winner.est,
      fin: winner.fin,
      newv: winner.newv,
      costType: winner.costType,
      status: winner.status,
      taskId: winner.taskId,
      hasDuplicate: true,
      duplicateTaskUrls: losers.map(l => taskUrl(l.taskId)),
    });
  }
  return result;
}

export function transformBudgetTasks(
  tasks: ClickUpTask[],
  projectName: string,
  projectLocation: string,
  projectId: string,
  coordInitials: string,
  coordName: string,
  biddingLows?: Map<string, number>,
): BudgetProject {
  const entries: RawEntry[] = tasks.map(task => {
    const est: MoneyVal = getCurrency(task, F.BUDGET_ALLOC);
    const updatedBudget: MoneyVal = getCurrency(task, F.UPDATED_BUDGET);
    const biddingLow: number | null = biddingLows?.get(task.name.trim()) ?? null;
    const fin: MoneyVal = updatedBudget !== null ? updatedBudget : biddingLow;
    const newv = deriveNewv(est, fin);
    const costType = getCostType(task);
    const status = task.status?.status ?? '';

    return {
      taskId: task.id,
      tradeName: task.name,
      est,
      fin,
      newv,
      costType,
      status,
      dateUpdated: task.date_updated,
    };
  });

  const trades = dedup(entries);

  return {
    name: projectName,
    location: projectLocation,
    id: projectId,
    phase: 'Budgeting',
    coordInitials,
    coordName,
    trades,
  };
}
