export type MoneyVal = number | 'INC' | 'NA' | null;

export interface BudgetTrade {
  trade: string;
  est: MoneyVal;
  fin: MoneyVal;
  newv: MoneyVal;
  manual?: boolean;
  costType?: 'hard' | 'soft';
  /** Workflow status from task.status.status ("to budget", "open for bidding", etc.) */
  status?: string;
  /** ClickUp task ID — used to build deep-links. */
  taskId?: string;
  /** True when this trade row was kept after deduplication of (costType, tradeName) pairs. */
  hasDuplicate?: boolean;
  /** ClickUp URLs of the duplicate tasks that were dropped during dedup. */
  duplicateTaskUrls?: string[];
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
