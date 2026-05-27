export const CLICKUP = {
  WORKSPACE_ID: process.env.CLICKUP_WORKSPACE_ID || '9017603275',
  ACTIVE_PROJECTS_SPACE_ID: process.env.CLICKUP_ACTIVE_PROJECTS_SPACE_ID || '90173230172',
  PLANS_LIST_NAME: '03. Plans',
  PERMITS_LIST_NAME: '04. Permits',
  PROJECT_OVERVIEW_LIST_NAME: '00. Project Overview',
  BASE_URL: process.env.NEXT_PUBLIC_CLICKUP_BASE_URL || 'https://app.clickup.com',
  // Master Projects Board — flat list of all active projects (portfolio metadata).
  MASTER_PROJECTS_BOARD_LIST_ID: '901710536629',
  // Single shared list for all bidding + budget trade rows across all projects.
  // Rows are differentiated by the Project ID short-text custom field.
  BUDGET_BIDDING_DB_LIST_ID: '901713908317',
  // Custom field IDs on Budget-Bidding Database (901713908317) trade tasks.
  // Use these by ID to avoid brittle name matching.
  FIELD: {
    // Relationship / lookup
    PROJECT_ID:    '0da6c33d-9953-4990-89b2-608b34ba0053', // short_text — matches project name
    PROJECT_NAME:  '6c490249-2011-4ff1-a84d-438dbfc7d60f', // list_relationship → Master Projects Board
    TRADE:         'f3cef4fb-a5bc-4a61-8ddd-048df2475b20', // drop_down — canonical trade name
    COST_TYPE:     'd31ad583-bfa3-4b02-98df-fb65f1ccbb7f', // drop_down — Hard Costs / Soft Costs
    // Bidding
    BIDDING_STATUS: 'f8084252-c3cc-4dc9-a21f-b9ddd6a4cf39', // drop_down — TO SEND / RFP SENT / …
    BEST_BID:      '4d9484b7-86a6-4466-9902-f93c0616beac', // currency
    LOWEST_BID:    '30090720-43df-42c0-80fd-4df8f16f2bc3', // currency
    CONTRACT:      '3d4711c5-4e42-4ca3-be33-01671b032067', // currency — set when AWARDED
    // Budget
    BUDGET_ALLOC:  '932ad261-d33f-4e50-83d0-cb5be27f3be9', // currency — estimated budget
    UPDATED_BUDGET: 'fababed6-f5d6-41e5-a078-24234ce9df56', // currency — manual override (per-project "01. Budget" lists)
    // Sub slots (name + amount pairs)
    SUB_1:         '01d90719-501b-4936-a178-d2b2896b6e08', // short_text
    SUB_2:         'f461f3f6-4f02-4f63-ad78-cfbae3c94837',
    SUB_3:         '5c425cc5-2a9e-49de-a024-7137a7b18fb2',
    SUB_4:         '099eaa36-c7d3-4013-9edf-b70d0c213421',
    SUB_5:         'cf12ad12-c7f1-49bf-aaca-bc38482a08fd',
    SUB_1_AMT:     'ebd419c4-356b-4521-ac9f-24ef4fc6ada2', // currency
    SUB_2_AMT:     '01781843-4830-47b2-8b6f-58cf84586aa0',
    SUB_3_AMT:     '02244ad8-9373-4105-97de-bb33a6c565dc',
    SUB_4_AMT:     '87d4e396-50f0-4995-a0c9-483f5c1f638e',
    SUB_5_AMT:     '7ea03080-824d-4cf9-9193-4a020bcf0919',
    SUBCONTRACTORS: 'f6d611a7-71e9-49d6-a95e-3301de536333', // labels — canonical sub directory
  },
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
