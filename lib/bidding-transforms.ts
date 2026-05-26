import type { ClickUpCustomFieldValue, ClickUpTask } from './clickup';
import type { BidStatus, BidSub, BidTrade, BiddingProject } from './bidding-types';
import { CLICKUP } from './constants';

const F = CLICKUP.FIELD;

// Maps ClickUp Bidding Status dropdown option names to the 8-color palette.
//
// The ClickUp field stores the selected option's orderindex as a number.
// FOLLOWED UP is always mapped to fu1. Bucketing into fu1/fu2/fu3 by age
// requires a dedicated last_contact_at timestamp field; when that field exists
// wire it here by comparing task.date_updated against Date.now().
function mapBiddingStatusName(name: string): BidStatus {
  switch (name.toUpperCase().trim()) {
    case 'TO SEND':            return 'ntb';
    case 'RFP SENT':           return 'snt';
    case 'FOLLOWED UP':        return 'fu1';
    // TO CLARIFY / LEVELED / REVIEWED all resolve to the same REC bucket per design spec
    case 'PROPOSALS RECEIVED': return 'rec';
    case 'TO CLARIFY':         return 'rec';
    case 'LEVELED':            return 'rec';
    case 'REVIEWED':           return 'rec';
    case 'REJECTED':           return 'hld';
    case 'AWARDED':            return 'fnl';
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

  // ClickUp stores dropdown values as the option's orderindex (number).
  // Fall back to matching by option id (string) for newer ClickUp API versions.
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

// ── Name-based helpers (used by per-project 02. Bidding lists) ────────────
// Field IDs differ per list; look up by the human-readable field name instead.

function getFieldByName(task: ClickUpTask, name: string): ClickUpCustomFieldValue | undefined {
  const lower = name.toLowerCase();
  return task.custom_fields?.find(f => f.name.toLowerCase() === lower);
}

function getStringByName(task: ClickUpTask, name: string): string | null {
  const f = getFieldByName(task, name);
  if (!f || f.value == null) return null;
  return typeof f.value === 'string' ? f.value.trim() || null : null;
}

function getCurrencyByName(task: ClickUpTask, name: string): number | null {
  const f = getFieldByName(task, name);
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Resolves bidding status from the task's own status field (per-project lists
// use ClickUp task status as the bidding stage, not a custom field).
// Falls back to a "Bidding Status" custom field if present for compatibility.
function getBiddingStatusByName(task: ClickUpTask): BidStatus {
  const f = getFieldByName(task, 'Bidding Status');
  if (f && f.value != null) {
    const options = (f.type_config?.options ?? []) as Array<{ id: string; name: string; orderindex: number }>;
    let opt: typeof options[0] | undefined;
    const numVal = Number(f.value);
    if (Number.isFinite(numVal)) opt = options.find(o => o.orderindex === numVal);
    if (!opt && typeof f.value === 'string') opt = options.find(o => o.id === f.value);
    if (opt) return mapBiddingStatusName(opt.name);
  }
  return mapBiddingStatusName(task.status?.status ?? '');
}

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

    // Build subs from Sub 1–5 fields. A sub slot is populated if the name field is non-empty.
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

    // Derive lowest bid: min of sub amounts, or fall back to Best Bid / Lowest Bid / Contract.
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

// Transforms tasks from a per-project "02. Bidding" list where field IDs differ
// per list. Looks up Sub 1-5 / amounts / status by field NAME instead of ID.
// Task name is the trade name; task status is the bidding stage.
export function transformBiddingTasksByName(
  tasks: ClickUpTask[],
  projectName: string,
  projectLocation: string,
  projectId: string,
  coordInitials: string,
  coordName: string,
): BiddingProject {
  const SUB_SLOTS: [string, string][] = [
    ['Sub 1', 'Sub 1 Amount'],
    ['Sub 2', 'Sub 2 Amount'],
    ['Sub 3', 'Sub 3 Amount'],
    ['Sub 4', 'Sub 4 Amount'],
    ['Sub 5', 'Sub 5 Amount'],
  ];

  const trades: BidTrade[] = tasks.map(task => {
    const tradeName = task.name;
    const tradeStatus = getBiddingStatusByName(task);

    const subs: BidSub[] = [];
    for (const [nameField, amtField] of SUB_SLOTS) {
      const name = getStringByName(task, nameField);
      if (!name) continue;
      subs.push({ name, amount: getCurrencyByName(task, amtField), status: tradeStatus });
    }

    let low: number | null = null;
    if (subs.length > 0) {
      const amounts = subs.map(s => s.amount).filter((a): a is number => a !== null);
      if (amounts.length > 0) low = Math.min(...amounts);
    }
    if (low === null) {
      low = getCurrencyByName(task, 'Best Bid')
        ?? getCurrencyByName(task, 'Lowest Bid')
        ?? getCurrencyByName(task, 'Contract');
    }

    return { trade: tradeName, annot: null, subs, low };
  });

  return { name: projectName, location: projectLocation, id: projectId, phase: 'Bidding', coordInitials, coordName, trades };
}
