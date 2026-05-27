import type { ClickUpCustomFieldValue, ClickUpTask } from './clickup';
import type { BudgetTrade, BudgetProject, MoneyVal } from './budget-types';
import type { AwardedBidEntry } from './bidding-lows';
import { CLICKUP } from './constants';

const F = CLICKUP.FIELD;

function getFieldById(task: ClickUpTask, id: string): ClickUpCustomFieldValue | undefined {
  return task.custom_fields?.find(f => f.id === id);
}

// Reads the "2. Trade Type" drop_down field: orderindex 0 = Biddable, 1 = Set.
function getTradeType(task: ClickUpTask): 'biddable' | 'set' | undefined {
  const f = getFieldById(task, F.TRADE_TYPE);
  if (!f || f.value == null) return undefined;
  const numVal = Number(f.value);
  if (numVal === 0) return 'biddable';
  if (numVal === 1) return 'set';
  // String option-ID fallback
  const options = (f.type_config?.options ?? []) as Array<{ id: string; name: string; orderindex?: number }>;
  const opt = options.find(o => o.id === String(f.value));
  if (opt?.orderindex === 0) return 'biddable';
  if (opt?.orderindex === 1) return 'set';
  return undefined;
}

// When the explicit Trade Type field isn't set, derive from the workflow status.
function deriveTradeTypeFromStatus(status: string): 'biddable' | 'set' {
  const s = status.toLowerCase();
  return s === 'budget set' || s === 'bid received' ? 'set' : 'biddable';
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
  return Number.isFinite(n) && n > 0 ? n : null;
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
  tradeType: 'biddable' | 'set' | undefined;
  dateUpdated: string | null | undefined;
  awardedBid: number | null;
  awardedSubName: string | null;
  finMismatch: boolean;
}

function taskUrl(taskId: string): string {
  return `https://app.clickup.com/t/${taskId}`;
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
        tradeType: e.tradeType,
        taskId: e.taskId,
        awardedBid: e.awardedBid ?? undefined,
        awardedSubName: e.awardedSubName ?? undefined,
        finMismatch: e.finMismatch || undefined,
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
      tradeType: winner.tradeType,
      taskId: winner.taskId,
      hasDuplicate: true,
      duplicateTaskUrls: losers.map(l => taskUrl(l.taskId)),
      awardedBid: winner.awardedBid ?? undefined,
      awardedSubName: winner.awardedSubName ?? undefined,
      finMismatch: winner.finMismatch || undefined,
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
  awardedBids?: Map<string, AwardedBidEntry>,
): BudgetProject {
  const entries: RawEntry[] = tasks.map(task => {
    const est: MoneyVal = getCurrency(task, F.BUDGET_ALLOC);
    const updatedBudget: MoneyVal = getCurrency(task, F.UPDATED_BUDGET);
    const biddingLow: number | null = biddingLows?.get(task.name.trim()) ?? null;
    const awardedEntry = awardedBids?.get(task.name.trim());
    const awardedBid: number | null = awardedEntry?.amount ?? null;
    const awardedSubName: string | null = awardedEntry?.subName ?? null;

    let fin: MoneyVal;
    let finMismatch = false;

    if (updatedBudget !== null) {
      // Manual "Updated Budget" override takes priority.
      fin = updatedBudget;
      // Flag when the override diverges from the awarded sub's bid.
      if (awardedBid !== null && Math.abs(updatedBudget - awardedBid) > 0.5) {
        finMismatch = true;
      }
    } else if (awardedBid !== null) {
      // No manual override — use awarded sub's bid as finalized value.
      fin = awardedBid;
    } else {
      // Neither override nor awarded bid — fall back to mathematical minimum.
      fin = biddingLow;
    }

    const newv = deriveNewv(est, fin);
    const costType = getCostType(task);
    const status = task.status?.status ?? '';
    const tradeType = getTradeType(task) ?? deriveTradeTypeFromStatus(status);

    return {
      taskId: task.id,
      tradeName: task.name,
      est,
      fin,
      newv,
      costType,
      status,
      tradeType,
      dateUpdated: task.date_updated,
      awardedBid,
      awardedSubName,
      finMismatch,
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
