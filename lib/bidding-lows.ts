import type { ClickUpList, ClickUpTask } from './clickup';

export function findBiddingList(lists: ClickUpList[]): ClickUpList | undefined {
  const candidates = ['02. bidding', '02 bidding', 'bidding'];
  for (const c of candidates) {
    const found = lists.find(l => l.name.toLowerCase() === c);
    if (found) return found;
  }
  return undefined;
}

export function computeBiddingLows(tasks: ClickUpTask[]): Map<string, number> {
  const parentNames = new Map<string, string>();
  for (const t of tasks) {
    if (!t.parent) parentNames.set(t.id, t.name.trim());
  }
  const lows = new Map<string, number>();
  for (const t of tasks) {
    if (!t.parent) continue;
    const tradeName = parentNames.get(t.parent);
    if (!tradeName) continue;
    const f = t.custom_fields?.find(cf => cf.name === 'Bid/Contracted Amount');
    if (!f || f.value == null) continue;
    const amt = Number(f.value);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const cur = lows.get(tradeName);
    if (cur === undefined || amt < cur) lows.set(tradeName, amt);
  }
  return lows;
}
