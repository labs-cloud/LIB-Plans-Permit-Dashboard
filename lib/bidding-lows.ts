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
  // Prefer the canonical BID_CONTRACTED field ID for precision; fall back to
  // name-based lookup for any list that uses the same name on a different ID.
  // Always exclude BUDGET_ALLOC even if it has been renamed to "Bid/Contracted Amount".
  const f = t.custom_fields?.find(
    cf =>
      cf.id === CLICKUP.FIELD.BID_CONTRACTED ||
      (cf.name === 'Bid/Contracted Amount' && cf.id !== CLICKUP.FIELD.BUDGET_ALLOC),
  );
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function recordLow(lows: Map<string, number>, tradeName: string, amt: number) {
  const cur = lows.get(tradeName);
  if (cur === undefined || amt < cur) lows.set(tradeName, amt);
}

// Normalise a raw ClickUp status for comparison: lowercase, fold em/en dashes
// to a plain hyphen, collapse whitespace. Mirrors mapBiddingStatusName in
// bidding-transforms.ts so both codepaths agree on status identity (e.g.
// "LEVELED — PENDING REVIEW" with an em dash).
function normStatus(task: ClickUpTask): string {
  return (task.status?.status ?? '')
    .toLowerCase()
    .replace(/[‒–—―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAwarded(task: ClickUpTask): boolean {
  return normStatus(task) === 'awarded';
}

// A "needs rebid" bid has been rejected/voided and must be re-solicited, so it
// must never be selected as a trade's lowest (or awarded) bid — the next
// non-flagged bid should win instead. Kept as an explicit guard so the rule
// survives any future change to the qualifying-status whitelist below.
function isNeedsRebid(task: ClickUpTask): boolean {
  const s = normStatus(task);
  return s === 'needs rebid' || s === 'rebid';
}

// A bid qualifies for the lowest-bid calculation only when the sub has
// actually submitted a number (not just received an RFP) and has not been
// flagged "needs rebid".
function isQualifyingBid(task: ClickUpTask): boolean {
  if (isNeedsRebid(task)) return false;
  const s = normStatus(task);
  return (
    s === 'proposals received' ||
    s === 'bid received' ||
    s === 'bid recieved' || // ClickUp's persistent typo
    s === 'to clarify' ||
    // Prefix match: covers "leveled" and variants like
    // "leveled - pending review" (any dash glyph, via normStatus).
    s.startsWith('leveled') ||
    s === 'pending review' ||
    s === 'reviewed' ||
    s === 'awarded'
  );
}

// Build trade option map from the Trade dropdown field schema (Schema B / flat lists).
function buildTradeOptionMap(tasks: ClickUpTask[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const t of tasks) {
    const f = t.custom_fields?.find(cf => cf.id === TRADE_FIELD_ID);
    if (!f?.type_config?.options) continue;
    for (const opt of f.type_config.options as { name: string; orderindex: number }[]) {
      map.set(opt.orderindex, opt.name);
    }
    break;
  }
  return map;
}

function detectHierarchy(tasks: ClickUpTask[]): boolean {
  const ids = new Set(tasks.map(t => t.id));
  return tasks.some(t => t.parent != null && ids.has(t.parent));
}

// Mirrors the schema detection in transformBiddingTasksByName so that both
// Schema A (parent/subtask hierarchy) and Schema B (flat tasks with Trade
// dropdown, e.g. 3930 Carpenter) produce correct lowest-bid values.
export function computeBiddingLows(tasks: ClickUpTask[]): Map<string, number> {
  const lows = new Map<string, number>();

  if (detectHierarchy(tasks)) {
    // Schema A: root task = trade, subtask = sub bid
    const parentNames = new Map<string, string>();
    for (const t of tasks) {
      if (!t.parent) parentNames.set(t.id, t.name.trim());
    }
    for (const t of tasks) {
      if (!t.parent || !isQualifyingBid(t)) continue;
      const tradeName = parentNames.get(t.parent);
      if (!tradeName) continue;
      const amt = getAmt(t);
      if (amt !== null) recordLow(lows, tradeName, amt);
    }
  } else {
    // Schema B: flat tasks, trade resolved from Trade dropdown field
    const optionMap = buildTradeOptionMap(tasks);
    for (const t of tasks) {
      if (!isQualifyingBid(t)) continue;
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

export interface AwardedBidEntry {
  amount: number;
  subName: string;
}

// Returns the bid amount of the sub with "Awarded" status for each trade.
// Handles both Schema A (hierarchy) and Schema B (flat) bidding lists.
export function computeAwardedBids(tasks: ClickUpTask[]): Map<string, AwardedBidEntry> {
  const result = new Map<string, AwardedBidEntry>();

  if (detectHierarchy(tasks)) {
    const parentNames = new Map<string, string>();
    for (const t of tasks) {
      if (!t.parent) parentNames.set(t.id, t.name.trim());
    }
    for (const t of tasks) {
      if (!t.parent || !isAwarded(t)) continue;
      const tradeName = parentNames.get(t.parent);
      if (!tradeName) continue;
      const amt = getAmt(t);
      if (amt !== null) result.set(tradeName, { amount: amt, subName: t.name.trim() });
    }
  } else {
    const optionMap = buildTradeOptionMap(tasks);
    for (const t of tasks) {
      if (!isAwarded(t)) continue;
      const tradeF = t.custom_fields?.find(cf => cf.id === TRADE_FIELD_ID);
      if (!tradeF || tradeF.value == null) continue;
      const tradeName = optionMap.get(Number(tradeF.value));
      if (!tradeName) continue;
      const amt = getAmt(t);
      if (amt !== null) result.set(tradeName, { amount: amt, subName: t.name.trim() });
    }
  }

  return result;
}

// Returns every "needs rebid" bid amount per trade. Used to stop a stale
// "Updated Budget" override — one that merely mirrors a bid since flagged for
// rebid — from resurfacing as the New Budget. A rejected bid must not drive the
// budget through any column.
export function computeNeedsRebidBids(tasks: ClickUpTask[]): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const add = (tradeName: string, amt: number) => {
    const arr = result.get(tradeName);
    if (arr) arr.push(amt);
    else result.set(tradeName, [amt]);
  };

  if (detectHierarchy(tasks)) {
    const parentNames = new Map<string, string>();
    for (const t of tasks) {
      if (!t.parent) parentNames.set(t.id, t.name.trim());
    }
    for (const t of tasks) {
      if (!t.parent || !isNeedsRebid(t)) continue;
      const tradeName = parentNames.get(t.parent);
      if (!tradeName) continue;
      const amt = getAmt(t);
      if (amt !== null) add(tradeName, amt);
    }
  } else {
    const optionMap = buildTradeOptionMap(tasks);
    for (const t of tasks) {
      if (!isNeedsRebid(t)) continue;
      const tradeF = t.custom_fields?.find(cf => cf.id === TRADE_FIELD_ID);
      if (!tradeF || tradeF.value == null) continue;
      const tradeName = optionMap.get(Number(tradeF.value));
      if (!tradeName) continue;
      const amt = getAmt(t);
      if (amt !== null) add(tradeName, amt);
    }
  }

  return result;
}
