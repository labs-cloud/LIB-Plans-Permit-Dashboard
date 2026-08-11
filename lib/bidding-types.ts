// Bid status tiers. The ordering below mirrors the real ClickUp lifecycle so
// the matrix can show the *most advanced* status per trade (see STATUS_RANK in
// BiddingDashboard). Three tiers were added to stop distinct statuses from
// collapsing into the wrong pill:
//   • wfp — "Waiting for Plans" (previously mis-mapped to ntb / "To Send")
//   • lvl — "Leveling"          (previously mis-mapped to ntb / "To Send")
//   • lvp — "Leveled — Pending Review" (previously mis-mapped to ntb)
//   • rvw — "Reviewed" (previously collapsed into lvp, so marking a bid reviewed
//     changed nothing on screen — the pill still read "Leveled · Pending Review")
export type BidStatus =
  | 'ntb' // NOT STARTED — To Send
  | 'snt' // RFP SENT
  | 'wfp' // WAITING FOR PLANS
  | 'fu1' // FOLLOWED UP · week 1
  | 'fu2' // FOLLOWED UP · week 2
  | 'fu3' // FOLLOWED UP · week 3
  | 'rec' // BID RECEIVED
  | 'lvl' // LEVELING
  | 'lvp' // LEVELED — PENDING REVIEW
  | 'rvw' // REVIEWED — leveling reviewed, awaiting the award decision
  | 'reb' // NEEDS REBID — bid rejected/void, must be re-solicited. Never counts as a lowest bid.
  | 'fnl' // AWARDED
  | 'hld'; // NO BID / DECLINED

export interface BidSub {
  name: string;
  amount: number | null;
  status: BidStatus;
  flag?: string;
  url?: string;
  // Raw status color straight from ClickUp (hex, e.g. "#f9d900"). Lets the
  // dashboard render matrix cells/pills in the exact colors ClickUp shows so the
  // two never disagree. Undefined when ClickUp reports no color for the status.
  color?: string | null;
}

export interface BidTrade {
  trade: string;
  annot: string | null;
  subs: BidSub[];
  low: number | null;
  taskId?: string;
}

export interface PortfolioProjectStub {
  name: string;
  location: string;
  isReal: boolean;
}

export interface BiddingProject {
  name: string;
  location: string;
  id: string;
  phase: string;
  coordInitials: string;
  coordName: string;
  trades: BidTrade[];
  // ClickUp folder id for this project, when known. Used to deep-link the
  // matrix project header straight to the project's folder in ClickUp.
  folderId?: string;
  // True when this Active-Projects folder has no matching record in the Master
  // Projects Board. Such projects are surfaced with an admin warning and left
  // out of portfolio aggregates rather than silently distorting the counts.
  unlinked?: boolean;
}

export interface BiddingPayload {
  project: BiddingProject;
  portfolioProjects: PortfolioProjectStub[];
  syncedAt: number;
  source?: 'live' | 'empty';
  warning?: string;
}

export interface BiddingPortfolioPayload {
  projects: BiddingProject[];
  syncedAt: number;
  source?: 'live' | 'empty';
  // Names of Active-Projects folders with no Master Projects Board record.
  // Empty/undefined when every folder is linked.
  unlinkedProjects?: string[];
}
