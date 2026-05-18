import type { CoordinatorId, PhaseId } from './constants';

export type StatusKey = 'AP' | 'FI' | 'WO' | 'TF' | 'TS';
export type PermitStatus = 'active' | 'expiring' | 'expired';
// The portfolio matrix uses the ClickUp Plan Type name as the column id
// (e.g. "Architectural", "Sprinkler System"). Loose string keeps the model
// honest about the fact that ClickUp owns the vocabulary.
export type MatrixColumn = string;

export interface Plan {
  id: string;
  name: string;
  status: StatusKey | null;
  rawStatus: string;
  planType: string | null;
  matrixColumn: MatrixColumn | null;
  assetType: string | null;
  filingPhase: string | null;
  filingDate: number | null;
  expirationDate: number | null;
  agencies: string[];
  filingLink: string | null;
  fieldLink: string | null;
  archiveDrive: string | null;
  dateUpdated: number;
}

export interface Permit {
  id: string;
  name: string;
  status: PermitStatus;
  rawStatus: string;
  permitType: string | null;
  filingPhase: string | null;
  agencies: string[];
  filingDate: number | null;
  expirationDate: number | null;
  amount: number | null;
  permitsDrive: string | null;
  dateUpdated: number;
  daysToExpiration: number | null;
}

export interface Project {
  folderId: string;
  name: string;
  meta: string | null;
  phase: PhaseId | null;
  phaseLabel: string | null;
  projectStatus: string | null;
  coord: CoordinatorId;
  plansListId: string | null;
  permitsListId: string | null;
  approvedPlansLink: string;
  plans: Plan[];
  permits: Permit[];
  matrix: Partial<Record<MatrixColumn, StatusKey>>;
  permitsSummary: {
    active: number;
    expiring: number;
    expired: number;
    total: number;
    label: string;
    color: string;
  };
  lastActivity: number;
  alert: { color: string; text: string } | null;
  urgency: number;
}

export interface KpiStripData {
  filingsInFlight: number;
  approved7d: number;
  waitingOn: number;
  expiring30d: number;
  expired: number;
}

export interface StickingItem {
  taskId: string;
  projectName: string;
  folderId: string;
  coord: CoordinatorId;
  severity: 1 | 2 | 3 | 4 | 5;
  color: string;
  bg: string;
  text: string;
  daysStuck: number;
}

export interface PermitsPanelData {
  active: number;
  activeProjects: number;
  expiring30d: number;
  expiring30dProjects: number;
  expired: number;
  timeline: { overdue: number; d0_7: number; d8_30: number; d31_60: number; d61_90: number };
  byAgency: { agency: string; count: number; color: string }[];
  attention: {
    taskId: string;
    projectName: string;
    folderId: string;
    coord: CoordinatorId;
    text: string;
    color: string;
    bg: string;
  }[];
  allPermitsListIds: string[];
}

export interface DashboardPayload {
  projects: Project[];
  assetTypes: string[];
  kpis: KpiStripData;
  sticking: StickingItem[];
  permits: PermitsPanelData;
  syncedAt: number;
  source: 'live' | 'empty';
  warning?: string;
}
