import type { ClickUpList, ClickUpTask } from './clickup';
import { CLICKUP } from './constants';

const TRADE_FIELD_ID = CLICKUP.FIELD.TRADE;

export function findBiddingList(lists: ClickUpList[]): ClickUpList | undefined {
  const candidates = ['02. bidding', '02 bidding', 'bidding'];
  for (const c of candidates) {
    const found = lists.find(l => l.name.toLowerCase() === c);
    if (found) return found;
  }
  return undefined;
}

function getAmt(t: ClickUpTask): number | null {
  const f = t.custom_fields?.find(cf => cf.name === 'Bid/Contracted Amount');
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function recordLow(lows: Map<string, number>, tradeName: string, amt: number) {
  const cur = lows.get(tradeName);
  if (cur === undefined || amt < cur) lows.set(tradeName, amt);
}

// Mirrors the schema detection in transformBiddingTasksByName so that both
// Schema A (parent/subtask hierarchy) and Schema B (flat tasks with Trade
// dropdown, e.g. 3930 Carpenter) produce correct lowest-bid values.
export function computeBiddingLows(tasks: ClickUpTask[]): Map<string, number> {
  const listTaskIds = new Set(tasks.map(t => t.id));
  const hasHierarchy = tasks.some(t => t.parent != null && listTaskIds.has(t.parent));
  const lows = new Map<string, number>();

  if (hasHierarchy) {
    // Schema A: root task = trade, subtask = sub bid
    const parentNames = new Map<string, string>();
    for (const t of tasks) {
      if (!t.parent) parentNames.set(t.id, t.name.trim());
    }
    for (const t of tasks) {
      if (!t.parent) continue;
      const tradeName = parentNames.get(t.parent);
      if (!tradeName) continue;
      const amt = getAmt(t);
      if (amt !== null) recordLow(lows, tradeName, amt);
    }
  } else {
    // Schema B: flat tasks, trade resolved from Trade dropdown field
    const optionMap = new Map<number, string>();
    for (const t of tasks) {
      const f = t.custom_fields?.find(cf => cf.id === TRADE_FIELD_ID);
      if (!f?.type_config?.options) continue;
      for (const opt of f.type_config.options as { name: string; orderindex: number }[]) {
        optionMap.set(opt.orderindex, opt.name);
      }
      break;
    }
    for (const t of tasks) {
      const f = t.custom_fields?.find(cf => cf.id === TRADE_FIELD_ID);
      if (!f || f.value == null) continue;
      const tradeName = optionMap.get(Number(f.value));
      if (!tradeName) continue;
      const amt = getAmt(t);
      if (amt !== null) recordLow(lows, tradeName, amt);
    }
  }

  return lows;
}
