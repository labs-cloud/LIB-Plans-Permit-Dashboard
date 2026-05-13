import { CLICKUP, PHASES } from './constants';
import type { PhaseId } from './constants';
import { planStatusKey, permitStatusKey } from './status-map';
import { buildMatrix, planTypeToColumn } from './plan-type-map';
import { deriveCoordinator } from './coordinator';
import type {
  ClickUpCustomFieldValue,
  ClickUpFolder,
  ClickUpList,
  ClickUpTask,
} from './clickup';
import {
  getFoldersInSpace,
  getListsInFolder,
  getTasksInList,
} from './clickup';
import type { Permit, Plan, Project } from './types';

const DAY = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 30;

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readDropdownName(field: ClickUpCustomFieldValue | undefined): string | null {
  if (!field || field.value == null) return null;
  const options = field.type_config?.options ?? [];
  if (typeof field.value === 'string') {
    const m = options.find((o) => o.id === field.value);
    return m?.name ?? field.value;
  }
  if (typeof field.value === 'number') {
    return options[field.value]?.name ?? null;
  }
  if (typeof field.value === 'object') {
    const v = field.value as { id?: string; name?: string };
    if (v.name) return v.name;
    if (v.id) return options.find((o) => o.id === v.id)?.name ?? null;
  }
  return null;
}

function readLabelsList(field: ClickUpCustomFieldValue | undefined): string[] {
  if (!field || field.value == null) return [];
  const options = field.type_config?.options ?? [];
  const value = field.value;
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') {
          return options.find((o) => o.id === v)?.name ?? v;
        }
        if (typeof v === 'object' && v && 'name' in v) {
          return String((v as { name: string }).name);
        }
        return null;
      })
      .filter((s): s is string => !!s);
  }
  return [];
}

function readUrl(field: ClickUpCustomFieldValue | undefined): string | null {
  if (!field || field.value == null) return null;
  if (typeof field.value === 'string') return field.value;
  if (typeof field.value === 'object') {
    const v = field.value as { url?: string };
    if (v.url) return v.url;
  }
  return null;
}

function readCurrency(field: ClickUpCustomFieldValue | undefined): number | null {
  if (!field || field.value == null) return null;
  const n = Number(field.value);
  return Number.isFinite(n) ? n : null;
}

function readDate(field: ClickUpCustomFieldValue | undefined): number | null {
  if (!field || field.value == null) return null;
  const n = Number(field.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findField(
  task: ClickUpTask,
  predicate: (name: string) => boolean,
): ClickUpCustomFieldValue | undefined {
  return task.custom_fields?.find((f) => predicate(f.name.toLowerCase()));
}

function phaseFromLabel(label: string | null): PhaseId | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  if (lower.includes('pre')) return 'pre';
  if (lower.includes('post')) return 'post';
  if (lower.includes('construction')) return 'con';
  return null;
}

function transformPlan(task: ClickUpTask): Plan {
  const planType = readDropdownName(findField(task, (n) => n === 'plan type'));
  const setType = readDropdownName(findField(task, (n) => n === 'set type'));
  const filingPhase = readDropdownName(findField(task, (n) => n === 'filing phase'));
  const filingDate = readDate(findField(task, (n) => n === 'filing date'));
  const expirationDate = readDate(findField(task, (n) => n === 'expiration date'));
  const agencies = readLabelsList(findField(task, (n) => n === 'agencies'));
  const filingLink = readUrl(findField(task, (n) => n.includes('filing plan link')));
  const fieldLink = readUrl(findField(task, (n) => n.includes('field plan link')));
  const archiveDrive = readUrl(findField(task, (n) => n.includes('archive')));

  const rawStatus = task.status?.status ?? '';
  const status = planStatusKey(rawStatus);
  const dateUpdated = parseMs(task.date_updated) ?? Date.now();

  return {
    id: task.id,
    name: task.name,
    status,
    rawStatus,
    planType,
    matrixColumn: planTypeToColumn(planType ?? task.name),
    setType,
    filingPhase,
    filingDate,
    expirationDate,
    agencies,
    filingLink,
    fieldLink,
    archiveDrive,
    dateUpdated,
  };
}

function transformPermit(task: ClickUpTask, now: number): Permit {
  const permitType = readDropdownName(findField(task, (n) => n === 'permit type'));
  const permitStatusFromField =
    readDropdownName(findField(task, (n) => n === 'permit status')) ?? task.status?.status ?? '';
  const filingPhase = readDropdownName(findField(task, (n) => n === 'filing phase'));
  const agencies = readLabelsList(findField(task, (n) => n === 'agencies'));
  const filingDate = readDate(findField(task, (n) => n === 'filing date'));
  const expirationDate = readDate(findField(task, (n) => n === 'expiration date'));
  const amount = readCurrency(findField(task, (n) => n === 'amount'));
  const permitsDrive = readUrl(findField(task, (n) => n.includes('permits drive')));

  let status = permitStatusKey(permitStatusFromField);
  let daysToExpiration: number | null = null;
  if (expirationDate != null) {
    daysToExpiration = Math.floor((expirationDate - now) / DAY);
    if (daysToExpiration < 0) status = 'expired';
    else if (daysToExpiration <= EXPIRING_SOON_DAYS && status === 'active') status = 'expiring';
  }

  return {
    id: task.id,
    name: task.name,
    status,
    rawStatus: permitStatusFromField,
    permitType,
    filingPhase,
    agencies,
    filingDate,
    expirationDate,
    amount,
    permitsDrive,
    dateUpdated: parseMs(task.date_updated) ?? now,
    daysToExpiration,
  };
}

function summarisePermits(permits: Permit[]) {
  const active = permits.filter((p) => p.status === 'active').length;
  const expiring = permits.filter((p) => p.status === 'expiring').length;
  const expired = permits.filter((p) => p.status === 'expired').length;
  const total = permits.length;

  let label: string;
  let color: string;
  if (expired > 0) {
    label = `● ${expired} expired`;
    color = '#791F1F';
  } else if (expiring > 0) {
    label = `● ${expiring} expiring`;
    color = '#BA7517';
  } else if (active > 0) {
    label = `● ${active} active`;
    color = '#173404';
  } else {
    label = '— none';
    color = '#5F5E5A';
  }
  return { active, expiring, expired, total, label, color };
}

function buildAlert(plans: Plan[], permits: Permit[], permitsSummary: ReturnType<typeof summarisePermits>, now: number) {
  if (permitsSummary.expired > 0) {
    const p = permits.find((x) => x.status === 'expired');
    const days = p?.daysToExpiration != null ? Math.abs(p.daysToExpiration) : 0;
    return { color: '#791F1F', text: `${p?.permitType ?? 'Permit'} expired${days > 0 ? ` ${days}d ago` : ''}` };
  }
  if (permitsSummary.expiring > 0) {
    const p = permits
      .filter((x) => x.status === 'expiring')
      .sort((a, b) => (a.daysToExpiration ?? 0) - (b.daysToExpiration ?? 0))[0];
    const days = p?.daysToExpiration ?? 0;
    return { color: '#BA7517', text: `${p?.permitType ?? 'Permit'} expires in ${days}d` };
  }
  const stuck = plans
    .filter((p) => p.status === 'WO')
    .map((p) => ({ p, days: Math.floor((now - p.dateUpdated) / DAY) }))
    .sort((a, b) => b.days - a.days);
  if (stuck.length > 0 && stuck[0].days >= 3) {
    return {
      color: stuck[0].days > 7 ? '#854F0B' : '#412402',
      text: `${stuck.length} waiting on · ${stuck[0].days}d`,
    };
  }
  if (permitsSummary.active > 0) {
    return { color: '#173404', text: `${permitsSummary.active} permits active` };
  }
  return null;
}

function buildMetaString(overview: ClickUpTask | undefined): string | null {
  if (!overview) return null;
  const stories =
    readDropdownName(findField(overview, (n) => n.includes('stories'))) ??
    readDropdownName(findField(overview, (n) => n.includes('floors')));
  const units =
    readDropdownName(findField(overview, (n) => n.includes('units'))) ??
    readDropdownName(findField(overview, (n) => n.includes('unit count')));
  const size = readDropdownName(findField(overview, (n) => n.includes('building size')));
  const bits = [stories, units, size].filter(Boolean);
  return bits.length ? bits.join(' · ') : null;
}

async function loadProject(folder: ClickUpFolder, now: number): Promise<Project | null> {
  let lists: ClickUpList[];
  try {
    lists = await getListsInFolder(folder.id);
  } catch (err) {
    console.error(`Failed to load lists for folder ${folder.id} (${folder.name})`, err);
    return null;
  }

  const plansList = lists.find((l) => l.name === CLICKUP.PLANS_LIST_NAME);
  const permitsList = lists.find((l) => l.name === CLICKUP.PERMITS_LIST_NAME);
  const overviewList = lists.find((l) => l.name === CLICKUP.PROJECT_OVERVIEW_LIST_NAME);

  const [planTasks, permitTasks, overviewTasks] = await Promise.all([
    plansList ? getTasksInList(plansList.id).catch(() => [] as ClickUpTask[]) : Promise.resolve([] as ClickUpTask[]),
    permitsList ? getTasksInList(permitsList.id).catch(() => [] as ClickUpTask[]) : Promise.resolve([] as ClickUpTask[]),
    overviewList ? getTasksInList(overviewList.id).catch(() => [] as ClickUpTask[]) : Promise.resolve([] as ClickUpTask[]),
  ]);

  const plans = planTasks.map(transformPlan);
  const permits = permitTasks.map((t) => transformPermit(t, now));

  const coord = deriveCoordinator([...overviewTasks, ...planTasks, ...permitTasks]);
  const overview = overviewTasks[0];
  const phaseLabel = readDropdownName(findField(overview ?? ({} as ClickUpTask), (n) => n === 'project phases' || n === 'project phase'));
  const phase = phaseFromLabel(phaseLabel);
  const projectStatus = readDropdownName(findField(overview ?? ({} as ClickUpTask), (n) => n === 'project status'));

  const matrix = buildMatrix(plans);
  const permitsSummary = summarisePermits(permits);
  const lastActivity = Math.max(
    overview ? parseMs(overview.date_updated) ?? 0 : 0,
    ...plans.map((p) => p.dateUpdated),
    ...permits.map((p) => p.dateUpdated),
    0,
  );

  return {
    folderId: folder.id,
    name: folder.name,
    meta: buildMetaString(overview),
    phase,
    phaseLabel: phase ? PHASES.find((p) => p.id === phase)?.label ?? phaseLabel : phaseLabel,
    projectStatus,
    coord,
    plansListId: plansList?.id ?? null,
    permitsListId: permitsList?.id ?? null,
    plans,
    permits,
    matrix,
    permitsSummary,
    lastActivity,
    alert: buildAlert(plans, permits, permitsSummary, now),
    urgency: 0,
  };
}

function rankUrgency(projects: Project[]): void {
  const score = (p: Project) => {
    if (p.permitsSummary.expired > 0) return 0;
    if (p.permitsSummary.expiring > 0) return 1;
    const stuck = p.plans.filter((pl) => pl.status === 'WO').length;
    if (stuck >= 3) return 2;
    if (stuck >= 1) return 3;
    if (p.permitsSummary.active > 0) return 4;
    return 5;
  };
  const sorted = [...projects].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  sorted.forEach((p, i) => {
    p.urgency = i + 1;
  });
}

export async function loadAllProjects(): Promise<Project[]> {
  const now = Date.now();
  const folders = await getFoldersInSpace(CLICKUP.ACTIVE_PROJECTS_SPACE_ID);
  // ClickUp rate-limits at 100 req/min per token. With ~43 projects × 2-3
  // requests we sit at ~130 — chunk into batches of 6 to stay well under it.
  const out: Project[] = [];
  const concurrency = 6;
  for (let i = 0; i < folders.length; i += concurrency) {
    const slice = folders.slice(i, i + concurrency);
    const results = await Promise.all(slice.map((f) => loadProject(f, now)));
    for (const r of results) if (r) out.push(r);
  }
  rankUrgency(out);
  return out;
}
