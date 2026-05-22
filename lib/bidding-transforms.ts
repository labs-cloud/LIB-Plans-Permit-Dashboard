import type { ClickUpCustomFieldValue, ClickUpTask } from './clickup';
import type { BidStatus, BidSub, BidTrade, BiddingProject } from './bidding-types';

/** Maps a raw ClickUp task status string to our 8-color BidStatus palette. */
export function mapBidStatus(raw: string): BidStatus {
  const s = raw.toLowerCase().trim().replace(/[-_]+/g, ' ');
  if (s === 'ntb' || (s.includes('not') && (s.includes('bid') || s.includes('bidding')))) return 'ntb';
  if (s === 'fnl' || s.includes('final') || s.includes('signed') || s.includes('awarded') || s.includes('contracted')) return 'fnl';
  if (s === 'hld' || s.includes('hold') || s.includes('paused')) return 'hld';
  if (s === 'fu3' || (s.includes('follow') && (s.includes('3') || s.includes('third')))) return 'fu3';
  if (s === 'fu2' || (s.includes('follow') && (s.includes('2') || s.includes('second')))) return 'fu2';
  if (s === 'fu1' || s.includes('follow') || s.includes('chase') || s.includes('remind')) return 'fu1';
  if (s === 'rec' || s.includes('received') || s.includes('in hand') || s.includes('quoted')) return 'rec';
  if (s === 'snt' || s.includes('sent') || s.includes('out for bid') || s.includes('out to bid')) return 'snt';
  return 'snt';
}

function getStr(f: ClickUpCustomFieldValue | undefined): string | null {
  if (!f || f.value == null) return null;
  if (typeof f.value === 'string') return f.value.trim() || null;
  return null;
}

function getNum(f: ClickUpCustomFieldValue | undefined): number | null {
  if (!f || f.value == null) return null;
  const n = Number(f.value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function findField(task: ClickUpTask, pred: (n: string) => boolean): ClickUpCustomFieldValue | undefined {
  return task.custom_fields?.find(f => pred(f.name.toLowerCase().trim()));
}

/**
 * Builds a BiddingProject from ClickUp tasks in a project's Bidding list.
 *
 * Two data models are auto-detected:
 *
 * Flat model (preferred): one task per bid (sub × trade).
 *   - task.name = sub company name
 *   - "trade" / "trade name" / "scope" custom field = trade name
 *   - "amount" / "bid amount" / "price" field = bid amount (currency)
 *   - "annotation" / "notes" / "trade notes" field = trade annotation
 *   - task status = bid status (mapped to 8-color palette)
 *
 * Trade model (fallback): one task per trade.
 *   - task.name = trade name
 *   - task status = representative bid status
 *   - "amount" / "price" field = committed amount
 */
export function transformBiddingTasks(
  tasks: ClickUpTask[],
  projectName: string,
  projectLocation: string,
  projectId: string,
  coordInitials: string,
  coordName: string,
): BiddingProject {
  // Detect flat model: any task has a "trade" field whose value differs from task name
  const isFlat = tasks.some(t => {
    const tf = findField(t, n => n === 'trade' || n === 'trade name' || n === 'scope' || n === 'division');
    const val = getStr(tf);
    return val !== null && val.toLowerCase().trim() !== t.name.toLowerCase().trim();
  });

  let trades: BidTrade[];

  if (isFlat) {
    const tradeMap = new Map<string, { annot: string | null; subs: BidSub[] }>();

    for (const task of tasks) {
      const tradeField = findField(task, n => n === 'trade' || n === 'trade name' || n === 'scope' || n === 'division');
      const tradeName = getStr(tradeField) ?? task.name;
      const amountField = findField(task, n => n.includes('amount') || n === 'price' || n === 'bid' || n === 'quote');
      const amount = getNum(amountField);
      const status = mapBidStatus(task.status?.status ?? '');
      const annotField = findField(task, n => n.includes('annot') || n === 'notes' || n.includes('trade note') || n === 'comment');
      const annot = getStr(annotField);

      if (!tradeMap.has(tradeName)) {
        tradeMap.set(tradeName, { annot, subs: [] });
      }
      const entry = tradeMap.get(tradeName)!;
      if (!entry.annot && annot) entry.annot = annot;
      entry.subs.push({ name: task.name, amount, status });
    }

    trades = Array.from(tradeMap.entries()).map(([trade, { annot, subs }]) => {
      const amounts = subs.map(s => s.amount).filter((a): a is number => a !== null);
      const low = amounts.length > 0 ? Math.min(...amounts) : null;
      return { trade, annot, subs, low };
    });
  } else {
    // Trade model: each task is one trade
    trades = tasks.map(task => {
      const amountField = findField(task, n => n.includes('amount') || n === 'price' || n === 'committed');
      const amount = getNum(amountField);
      const status = mapBidStatus(task.status?.status ?? '');
      const annotField = findField(task, n => n.includes('annot') || n === 'notes');
      const annot = getStr(annotField);
      const subs: BidSub[] = amount !== null ? [{ name: task.name, amount, status }] : [];
      return { trade: task.name, annot, subs, low: amount };
    });
  }

  return { name: projectName, location: projectLocation, id: projectId, phase: 'Bidding', coordInitials, coordName, trades };
}
