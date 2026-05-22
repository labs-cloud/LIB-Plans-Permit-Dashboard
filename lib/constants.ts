export const CLICKUP = {
  WORKSPACE_ID: process.env.CLICKUP_WORKSPACE_ID || '9017603275',
  ACTIVE_PROJECTS_SPACE_ID: process.env.CLICKUP_ACTIVE_PROJECTS_SPACE_ID || '90173230172',
  PLANS_LIST_NAME: '03. Plans',
  PERMITS_LIST_NAME: '04. Permits',
  PROJECT_OVERVIEW_LIST_NAME: '00. Project Overview',
  BASE_URL: process.env.NEXT_PUBLIC_CLICKUP_BASE_URL || 'https://app.clickup.com',
  // Master Projects Board — flat list of all active projects (portfolio metadata).
  MASTER_PROJECTS_BOARD_LIST_ID: '901710536629',
  // Candidate list names for per-project Bidding and Budget lists.
  // The transforms check these in order and use the first match found.
  BIDDING_LIST_NAMES: ['02. Bidding', 'Bidding', '02. Bid', '01. Bidding', '00. Bidding'],
  BUDGET_LIST_NAMES: ['01. Budget', 'Budget', '05. Budget', '02. Budget', '00. Budget'],
} as const;

export type CoordinatorId = 'faigy' | 'malky' | 'unassigned';

export interface CoordinatorMeta {
  id: CoordinatorId;
  name: string;
  email: string;
  initials: string;
  color: string;
  bg: string;
  bgActive: string;
  textDark: string;
}

export const COORDINATORS: CoordinatorMeta[] = [
  {
    id: 'faigy',
    name: 'Faigy Follman',
    email: 'faigy@leaditbuilders.com',
    initials: 'FF',
    color: '#534AB7',
    bg: '#EEEDFE',
    bgActive: '#CECBF6',
    textDark: '#26215C',
  },
  {
    id: 'malky',
    name: 'Malky Kahan',
    email: 'mkahan@leaditbuilders.com',
    initials: 'MK',
    color: '#0F6E56',
    bg: '#E1F5EE',
    bgActive: '#9FE1CB',
    textDark: '#04342C',
  },
];

export const UNASSIGNED: CoordinatorMeta = {
  id: 'unassigned',
  name: 'Unassigned',
  email: '',
  initials: '?',
  color: '#5F5E5A',
  bg: '#F1EFE8',
  bgActive: '#D3D1C7',
  textDark: '#2C2C2A',
};

export const COORD_BY_ID: Record<CoordinatorId, CoordinatorMeta> = {
  faigy: COORDINATORS[0],
  malky: COORDINATORS[1],
  unassigned: UNASSIGNED,
};

export const PHASES = [
  { id: 'pre' as const, label: 'Pre-construction', bg: '#EEEDFE', text: '#26215C', sub: '#534AB7', subline: 'filings in flight' },
  { id: 'con' as const, label: 'Construction', bg: '#E1F5EE', text: '#04342C', sub: '#0F6E56', subline: 'permits active' },
  { id: 'post' as const, label: 'Post-construction', bg: '#F1EFE8', text: '#2C2C2A', sub: '#5F5E5A', subline: 'closeout pending' },
];

export type PhaseId = 'pre' | 'con' | 'post';

export const CACHE_TTL_SECONDS = 60;

// Shared SharePoint folder for approved plans. Linked from every project row
// so coordinators can jump to the archive without navigating through ClickUp.
export const APPROVED_PLANS_LINK =
  'https://leaditbuilders.sharepoint.com/:f:/s/LeaditBuilders/IgAe5AdWtMkoRK6Gg0eHUI6CAe93fjfZ5_BTqPn-5FfTOig?e=5qIY0x';
