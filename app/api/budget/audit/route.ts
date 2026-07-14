import { NextResponse } from 'next/server';
import { hasClickUpToken, getFoldersInSpace, getListsInFolder, getTasksInList } from '@/lib/clickup';
import { transformBudgetTasks } from '@/lib/budget-transforms';
import { findBiddingList, computeBiddingLows, computeAwardedBids, computeNeedsRebidBids } from '@/lib/bidding-lows';
import type { ClickUpList } from '@/lib/clickup';
import { CLICKUP } from '@/lib/constants';

export const runtime = 'nodejs';

function findBudgetList(lists: ClickUpList[]): ClickUpList | undefined {
  const candidates = ['01. budget', '01 budget', 'budget'];
  for (const c of candidates) {
    const found = lists.find(l => l.name.toLowerCase() === c);
    if (found) return found;
  }
  return undefined;
}

export interface AuditMismatch {
  trade: string;
  taskId: string;
  finalized: number;
  awardedBid: number;
  awardedSubName: string;
  diffAmount: number;
  diffPct: number;
}

export interface AuditPayload {
  project: string;
  mismatches: AuditMismatch[];
  totalTrades: number;
  syncedAt: number;
}

export async function GET(req: Request) {
  if (!hasClickUpToken()) {
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN not set' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  try {
    const folders = await getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID);
    const targetFolder = projectId
      ? (folders.find(f => f.name === projectId) ?? folders[0])
      : folders[0];

    if (!targetFolder) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 });
    }

    const lists = await getListsInFolder(targetFolder.id);
    const budgetList = findBudgetList(lists);
    const biddingListInFolder = findBiddingList(lists);

    if (!budgetList) {
      return NextResponse.json<AuditPayload>({
        project: targetFolder.name,
        mismatches: [],
        totalTrades: 0,
        syncedAt: Date.now(),
      });
    }

    const [tasks, biddingTasks] = await Promise.all([
      getTasksInList(budgetList.id, true),
      biddingListInFolder ? getTasksInList(biddingListInFolder.id, true, true) : Promise.resolve([]),
    ]);

    const biddingLows = computeBiddingLows(biddingTasks);
    const awardedBids = computeAwardedBids(biddingTasks);
    const needsRebidBids = computeNeedsRebidBids(biddingTasks);
    const project = transformBudgetTasks(tasks, targetFolder.name, '', targetFolder.id, '', '', biddingLows, awardedBids, needsRebidBids);

    const mismatches: AuditMismatch[] = project.trades
      .filter(t => t.finMismatch && t.taskId && typeof t.fin === 'number' && t.awardedBid !== undefined)
      .map(t => {
        const finalized = t.fin as number;
        const awardedBid = t.awardedBid as number;
        const diff = finalized - awardedBid;
        const diffPct = awardedBid > 0 ? (diff / awardedBid) * 100 : 0;
        return {
          trade: t.trade,
          taskId: t.taskId as string,
          finalized,
          awardedBid,
          awardedSubName: t.awardedSubName ?? '',
          diffAmount: diff,
          diffPct,
        };
      })
      .sort((a, b) => Math.abs(b.diffAmount) - Math.abs(a.diffAmount));

    return NextResponse.json<AuditPayload>({
      project: targetFolder.name,
      mismatches,
      totalTrades: project.trades.length,
      syncedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
