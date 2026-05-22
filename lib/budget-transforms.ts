import type { ClickUpCustomFieldValue, ClickUpTask } from './clickup';
import type { BudgetTrade, BudgetProject, MoneyVal } from './budget-types';

// These three trades always carry a MANUAL badge regardless of ClickUp field values.
// The auto-rule (finalized → use finalized; no bid → carry-forward estimate) is
// bypassed for them; verbatim ClickUp values are used as-is.
const MANUAL_TRADE_NAMES = new Set([
  'Structure',
  'Site safety coordination',
  'Lighting Material',
]);

function findField(task: ClickUpTask, pred: (n: string) => boolean): ClickUpCustomFieldValue | undefined {
  return task.custom_fields?.find(f => pred(f.name.toLowerCase().trim()));
}

function readCurrency(f: ClickUpCustomFieldValue | undefined): number | null {
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Returns true when the status string signals "Included" (rolled into another trade). */
function isIncludedStatus(raw: string): boolean {
  const s = raw.toLowerCase().trim();
  return s === 'inc' || s === 'included' || s.includes('incl') || s === 'rolled up' || s === 'in scope';
}

/** Returns true when the status string signals "Not Applicable". */
function isNaStatus(raw: string): boolean {
  const s = raw.toLowerCase().trim();
  return s === 'na' || s === 'n/a' || s === 'not applicable' || s === 'n.a.' || s === 'not app';
}

function readMoneyVal(
  currencyField: ClickUpCustomFieldValue | undefined,
  typeField: ClickUpCustomFieldValue | undefined,
  taskStatus: string,
): MoneyVal {
  // 1. Check an explicit "type" field (e.g., "Est Type" dropdown: INC / NA / Value)
  if (typeField) {
    const raw = typeof typeField.value === 'string' ? typeField.value : '';
    if (isIncludedStatus(raw)) return 'INC';
    if (isNaStatus(raw)) return 'NA';
  }
  // 2. Check task status
  if (isIncludedStatus(taskStatus)) return 'INC';
  if (isNaStatus(taskStatus)) return 'NA';
  // 3. Read currency
  const n = readCurrency(currencyField);
  return n; // null means "no value"
}

/** Auto-rule: derive newv from est + fin (skipped for MANUAL trades). */
function deriveNewv(est: MoneyVal, fin: MoneyVal): MoneyVal {
  if (fin !== null) return fin;   // finalized or INC/NA → use verbatim
  if (est === 'INC' || est === 'NA') return est;
  return est;                      // no bid yet → carry-forward estimate
}

/**
 * Builds a BudgetProject from ClickUp tasks in a project's Budget list.
 *
 * Expected task model: one task per trade line-item.
 *   - task.name = trade name
 *   - "estimated" / "estimate" / "est" custom field (currency) = estimated budget
 *   - "new budget" / "committed" / "finalized" / "budget" field (currency) = committed
 *   - "est type" / "budget type" dropdown: "INC" | "NA" | (empty = use currency)
 *   - task status: "Included" / "N/A" signals INC / NA when currency is absent
 *   - "manual" / "manual override" checkbox = manual flag (always overridden for 3 fixed trades)
 */
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
    const taskStatus = task.status?.status ?? '';

    const estField = findField(task, n =>
      n === 'estimated' || n === 'estimate' || n === 'est' || n === 'estimated budget' || n === 'budget estimate',
    );
    const estTypeField = findField(task, n => n === 'est type' || n === 'estimate type');

    const finField = findField(task, n =>
      n === 'new budget' || n === 'committed' || n === 'finalized' || n === 'final' ||
      n === 'budget' || n === 'fin' || n === 'contracted amount' || n === 'signed amount',
    );
    const finTypeField = findField(task, n => n === 'budget type' || n === 'fin type' || n === 'committed type');

    const est = readMoneyVal(estField, estTypeField, taskStatus);
    const fin = readMoneyVal(finField, finTypeField, taskStatus);
    const newv = isManual ? fin : deriveNewv(est, fin);

    return { trade: tradeName, est, fin, newv, manual: isManual || undefined };
  });

  return { name: projectName, location: projectLocation, id: projectId, phase: 'Budgeting', coordInitials, coordName, trades };
}
