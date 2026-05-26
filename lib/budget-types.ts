export type MoneyVal = number | 'INC' | 'NA' | null;

export interface BudgetTrade {
  trade: string;
  est: MoneyVal;
  fin: MoneyVal;
  newv: MoneyVal;
  manual?: boolean;
}

export interface BudgetProject {
  name: string;
  location: string;
  id: string;
  phase: string;
  coordInitials: string;
  coordName: string;
  trades: BudgetTrade[];
}

export interface BudgetPortfolioStub {
  name: string;
  loc: string;
  real?: boolean;
}

export interface BudgetPayload {
  project: BudgetProject;
  portfolioProjects: BudgetPortfolioStub[];
  syncedAt: number;
  source?: 'live' | 'empty';
  warning?: string;
}

export interface BudgetPortfolioPayload {
  projects: BudgetProject[];
  syncedAt: number;
  source?: 'live' | 'empty';
  warning?: string;
}
