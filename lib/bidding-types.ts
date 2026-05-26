export type BidStatus = 'ntb' | 'snt' | 'rec' | 'hld' | 'fnl' | 'fu1' | 'fu2' | 'fu3';

export interface BidSub {
  name: string;
  amount: number | null;
  status: BidStatus;
  flag?: string;
}

export interface BidTrade {
  trade: string;
  annot: string | null;
  subs: BidSub[];
  low: number | null;
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
}
