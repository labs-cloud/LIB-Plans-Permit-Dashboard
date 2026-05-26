import type { ClickUpCustomFieldValue, ClickUpTask } from './clickup';
import type { BudgetTrade, BudgetProject, MoneyVal } from './budget-types';
import { CLICKUP } from './constants';

const F = CLICKUP.FIELD;

// These three trades always carry the MANUAL badge. The auto-rule is bypassed
// for them — their New Budget value is taken verbatim from ClickUp (Contract
// → Best Bid → Budget Allocated) rather than being recomputed.
const MANUAL_TRADE_NAMES = new Set([
  'Structure',
  'Site safety coordination',
  'Lighting Material',
]);

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

// Auto-rule: if a finalized/lowest bid exists use it; otherwise carry-forward the estimate.
function deriveNewv(est: MoneyVal, fin: MoneyVal): MoneyVal {
  if (fin !== null && fin !== undefined) return fin;
  return est;
}

export function transformBudgetTasks(
  tasks: ClickUpTask[],
  projectName: string,
  projectLocation: string,
  projectId: string,
  coordInitials: string,
  coordName: string,
): BudgetProject {
  const trades: BudgetTrade[] = tasks.map(task => {
    const tradeName = task.name;
    const isManual = MANUAL_TRADE_NAMES.has(tradeName);

    // est = Budget Allocated custom field
    const est: MoneyVal = getCurrency(task, F.BUDGET_ALLOC);

    // fin = Contract (set when AWARDED) → Best Bid → Lowest Bid
    const fin: MoneyVal = getCurrency(task, F.CONTRACT)
      ?? getCurrency(task, F.BEST_BID)
      ?? getCurrency(task, F.LOWEST_BID);

    // MANUAL trades keep verbatim values; non-manual apply the auto-rule
    const newv = deriveNewv(est, fin);

    const costType = getCostType(task);
    return { trade: tradeName, est, fin, newv, manual: isManual || undefined, costType };
  });

  return { name: projectName, location: projectLocation, id: projectId, phase: 'Budgeting', coordInitials, coordName, trades };
}
