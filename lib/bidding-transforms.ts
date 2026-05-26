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

// ── Link field trade fallback ─────────────────────────────────────────────

// Extracts the trade name from the "🔗 Link" SharePoint URL (field b0da1f9e).
// URL pattern: .../Bids/{Trade Folder}/{Sub Name}
// Returns the second-to-last decoded path segment, or null if not parseable.
function extractTradeFromLink(task: ClickUpTask): string | null {
  const f = task.custom_fields?.find(cf => cf.id === 'b0da1f9e');
  if (!f || typeof f.value !== 'string' || !f.value) return null;
  try {
    const url = new URL(f.value);
    const segments = url.pathname.split('/').map(s => decodeURIComponent(s)).filter(Boolean);
    const bidsIdx = segments.findLastIndex(s => s.toLowerCase() === 'bids');
    if (bidsIdx !== -1 && bidsIdx + 1 < segments.length - 1) {
      return segments[bidsIdx + 1] || null;
    }
    if (segments.length >= 2) return segments[segments.length - 2] || null;
    return null;
  } catch {
    return null;
  }
}

// ── Trade dropdown helpers (field ID is global/shared across all lists) ───

type TradeOption = { name: string; orderindex: number };

// Extracts the orderindex→name map from the "Trade" dropdown field on any task
// in the list. All tasks share the same field schema so we only need one.
function buildTradeOptionMap(tasks: ClickUpTask[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const task of tasks) {
    const f = getFieldById(task, F.TRADE);
    if (!f?.type_config?.options) continue;
    for (const opt of f.type_config.options as TradeOption[]) {
      map.set(opt.orderindex, opt.name);
    }
    break;
  }
  return map;
}

// Returns the trade name for a single task using the option map.
// The Trade field stores the selected option's orderindex as a number.
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
      subs.push({ name, amount: getCurrency(task, amtId), status: tradeStatus });
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
// Schema (confirmed from live ClickUp data):
//   • One task = one subcontractor bidding on one trade
//   • task.name             = subcontractor company name
//   • task.status.status    = bidding stage (e.g. "not started", "bid recieved",
//                             "followed up", "awarded", "no bid / declined")
//   • Field F.TRADE         = "Trade" drop_down — orderindex resolves to trade name
//                             (same field ID as the central Budget-Bidding DB)
//   • Field "Bid/Contracted Amount" (currency) = the sub's bid/contract amount
//
// The function groups tasks by trade, then assembles up to 5 subs per row and
// computes the lowest bid as MIN(bid amounts for that trade).
// Tasks whose Trade field is unset are skipped with a console.warn.
export function transformBiddingTasksByName(
  tasks: ClickUpTask[],
  projectName: string,
  projectLocation: string,
  projectId: string,
  coordInitials: string,
  coordName: string,
): BiddingProject {
  const tradeOptionMap = buildTradeOptionMap(tasks);

  // Group bid tasks by trade name, preserving insertion order.
  const byTrade = new Map<string, ClickUpTask[]>();
  for (const task of tasks) {
    const tradeName = resolveTradeForTask(task, tradeOptionMap) ?? extractTradeFromLink(task);
    if (!tradeName) {
      console.warn(`[bidding] task "${task.name}" (${task.id}) has no Trade set — skipping`);
      continue;
    }
    if (!byTrade.has(tradeName)) byTrade.set(tradeName, []);
    byTrade.get(tradeName)!.push(task);
  }

  const trades: BidTrade[] = [];
  for (const [tradeName, bidTasks] of byTrade) {
    const subs: BidSub[] = bidTasks.slice(0, 5).map(task => ({
      name: task.name.trim(),
      amount: getCurrencyByName(task, 'Bid/Contracted Amount'),
      status: mapBiddingStatusName(task.status?.status ?? ''),
    }));

    const amounts = subs.map(s => s.amount).filter((a): a is number => a !== null);
    const low = amounts.length > 0 ? Math.min(...amounts) : null;

    trades.push({ trade: tradeName, annot: null, subs, low });
  }

  return { name: projectName, location: projectLocation, id: projectId, phase: 'Bidding', coordInitials, coordName, trades };
}
