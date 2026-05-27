import type { ClickUpCustomFieldValue, ClickUpTask } from './clickup';
import type { BidStatus, BidSub, BidTrade, BiddingProject } from './bidding-types';
import { CLICKUP } from './constants';

const F = CLICKUP.FIELD;

// Maps ClickUp status names to the 8-color palette.
// Handles both the central Budget-Bidding DB's custom-field option names AND
// the per-project 02. Bidding list's native task statuses (lowercase, some with
// ClickUp's persistent "recieved" typo).
function mapBiddingStatusName(name: string): BidStatus {
  switch (name.toUpperCase().trim()) {
    // Central list custom-field option names
    case 'TO SEND':            return 'ntb';
    case 'RFP SENT':           return 'snt';
    case 'FOLLOWED UP':        return 'fu1';
    case 'PROPOSALS RECEIVED': return 'rec';
    case 'TO CLARIFY':         return 'rec';
    case 'LEVELED':            return 'rec';
    case 'REVIEWED':           return 'rec';
    case 'REJECTED':           return 'hld';
    case 'AWARDED':            return 'fnl';
    // Per-project list native task statuses
    case 'NOT STARTED':        return 'ntb';
    case 'BID RECIEVED':       return 'rec'; // ClickUp's persistent typo
    case 'BID RECEIVED':       return 'rec';
    case 'NO BID / DECLINED':  return 'hld';
    case 'NO BID':             return 'hld';
    default:                   return 'ntb';
  }
}

// ── ID-based helpers (used by central Budget-Bidding DB fallback) ──────────

function getFieldById(task: ClickUpTask, id: string): ClickUpCustomFieldValue | undefined {
  return task.custom_fields?.find(f => f.id === id);
}

function getString(task: ClickUpTask, id: string): string | null {
  const f = getFieldById(task, id);
  if (!f || f.value == null) return null;
  return typeof f.value === 'string' ? f.value.trim() || null : null;
}

function getCurrency(task: ClickUpTask, id: string): number | null {
  const f = getFieldById(task, id);
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function getBiddingStatus(task: ClickUpTask): BidStatus {
  const f = getFieldById(task, F.BIDDING_STATUS);
  if (!f || f.value == null) return 'ntb';

  const options = (f.type_config?.options ?? []) as Array<{ id: string; name: string; orderindex: number }>;
  let opt: typeof options[0] | undefined;

  const numVal = Number(f.value);
  if (Number.isFinite(numVal)) {
    opt = options.find(o => o.orderindex === numVal);
  }
  if (!opt && typeof f.value === 'string') {
    opt = options.find(o => o.id === f.value);
  }

  return mapBiddingStatusName(opt?.name ?? '');
}

// ── Name-based currency helper (shared by both transforms) ────────────────

function getCurrencyByName(task: ClickUpTask, name: string): number | null {
  const lower = name.toLowerCase();
  const f = task.custom_fields?.find(cf => cf.name.toLowerCase() === lower);
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ── Trade dropdown helpers (flat "Bid" schema — e.g. 3930 Carpenter) ──────
//
// Some per-project "02. Bidding" lists use a flat schema where:
//   - Each task is a sub bid (task_type = "Bid", parent = null)
//   - Trade is stored in the global Trade dropdown field (F.TRADE)
//
// These helpers group flat tasks by Trade dropdown value.

type TradeOption = { name: string; orderindex: number };

function buildTradeOptionMap(tasks: ClickUpTask[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const task of tasks) {
    const f = getFieldById(task, F.TRADE);
    if (!f?.type_config?.options) continue;
    for (const opt of f.type_config.options as TradeOption[]) {
      map.set(opt.orderindex, opt.name);
    }
    break; // all tasks share the same field schema
  }
  return map;
}

function resolveTradeForTask(task: ClickUpTask, optionMap: Map<number, string>): string | null {
  const f = getFieldById(task, F.TRADE);
  if (!f || f.value == null) return null;
  const numVal = Number(f.value);
  if (!Number.isFinite(numVal)) return null;
  return optionMap.get(numVal) ?? null;
}

// ── Transforms ────────────────────────────────────────────────────────────

export function transformBiddingTasks(
  tasks: ClickUpTask[],
  projectName: string,
  projectLocation: string,
  projectId: string,
  coordInitials: string,
  coordName: string,
): BiddingProject {
  const trades: BidTrade[] = tasks.map(task => {
    const tradeName = task.name;
    const tradeStatus = getBiddingStatus(task);

    const subs: BidSub[] = [];
    const slots: [string, string][] = [
      [F.SUB_1, F.SUB_1_AMT],
      [F.SUB_2, F.SUB_2_AMT],
      [F.SUB_3, F.SUB_3_AMT],
      [F.SUB_4, F.SUB_4_AMT],
      [F.SUB_5, F.SUB_5_AMT],
    ];
    for (const [nameId, amtId] of slots) {
      const name = getString(task, nameId);
      if (!name) continue;
      subs.push({ name, amount: getCurrency(task, amtId), status: tradeStatus, url: task.url });
    }

    let low: number | null = null;
    if (subs.length > 0) {
      const amounts = subs.map(s => s.amount).filter((a): a is number => a !== null);
      if (amounts.length > 0) low = Math.min(...amounts);
    }
    if (low === null) {
      low = getCurrency(task, F.BEST_BID)
        ?? getCurrency(task, F.LOWEST_BID)
        ?? getCurrency(task, F.CONTRACT);
    }

    return { trade: tradeName, annot: null, subs, low };
  });

  return { name: projectName, location: projectLocation, id: projectId, phase: 'Bidding', coordInitials, coordName, trades };
}

// Transforms tasks from a per-project "02. Bidding" list.
//
// Two confirmed schemas exist across projects (live ClickUp data, May 2026):
//
// Schema A — Hierarchy (e.g. 1931-1935 Bedford Ave):
//   • Root tasks  (task.parent = null,       task_type = "Trade")   → one row per trade
//   • Subtasks    (task.parent = trade ID,   task_type = "Contact") → one row per sub bid
//   • Trade name from parent task.name; sub name from subtask.name
//   • Requires getTasksInList(..., includeSubtasks=true)
//
// Schema B — Flat (e.g. 3930 Carpenter):
//   • All tasks are root-level (task_type = "Bid", parent = null)
//   • Each task = one sub bid; trade resolved from Trade dropdown (F.TRADE)
//   • Sub name = task.name; grouping key = Trade dropdown option name
//
// Detection: if any task points to another task in the same list as its parent
// → Schema A (hierarchy). Otherwise → Schema B (flat).
export function transformBiddingTasksByName(
  tasks: ClickUpTask[],
  projectName: string,
  projectLocation: string,
  projectId: string,
  coordInitials: string,
  coordName: string,
): BiddingProject {
  const listTaskIds = new Set(tasks.map(t => t.id));
  const hasHierarchy = tasks.some(t => t.parent != null && listTaskIds.has(t.parent));

  const byTrade = new Map<string, ClickUpTask[]>();
  const tradeNameToTaskId = new Map<string, string>();

  if (hasHierarchy) {
    // ── Schema A: parent/subtask hierarchy ──────────────────────────────────
    const parentIdToName = new Map<string, string>();
    for (const task of tasks) {
      if (!task.parent) {
        parentIdToName.set(task.id, task.name.trim());
        tradeNameToTaskId.set(task.name.trim(), task.id);
      }
    }
    // Pre-populate buckets in ClickUp list order.
    for (const tradeName of parentIdToName.values()) {
      byTrade.set(tradeName, []);
    }
    for (const task of tasks) {
      if (!task.parent) continue;
      const tradeName = parentIdToName.get(task.parent);
      if (!tradeName) {
        console.warn(`[bidding] subtask "${task.name}" (${task.id}) parent=${task.parent} not in list — skipping`);
        continue;
      }
      byTrade.get(tradeName)!.push(task);
    }
  } else {
    // ── Schema B: flat "Bid" tasks grouped by Trade dropdown ────────────────
    const tradeOptionMap = buildTradeOptionMap(tasks);
    for (const task of tasks) {
      const tradeName = resolveTradeForTask(task, tradeOptionMap);
      if (!tradeName) {
        console.warn(`[bidding] task "${task.name}" (${task.id}) has no Trade set — skipping`);
        continue;
      }
      if (!byTrade.has(tradeName)) byTrade.set(tradeName, []);
      byTrade.get(tradeName)!.push(task);
    }
  }

  const trades: BidTrade[] = [];
  for (const [tradeName, bidTasks] of byTrade) {
    if (bidTasks.length === 0) continue;

    const subs: BidSub[] = bidTasks.slice(0, 5).map(task => ({
      name: task.name.trim(),
      amount: getCurrencyByName(task, 'Bid/Contracted Amount'),
      status: mapBiddingStatusName(task.status?.status ?? ''),
      url: task.url,
    }));

    const amounts = subs.map(s => s.amount).filter((a): a is number => a !== null);
    const low = amounts.length > 0 ? Math.min(...amounts) : null;

    trades.push({ trade: tradeName, annot: null, subs, low, taskId: tradeNameToTaskId.get(tradeName) });
  }

  return { name: projectName, location: projectLocation, id: projectId, phase: 'Bidding', coordInitials, coordName, trades };
}
