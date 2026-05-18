import type { Permit, PermitStatus, Project } from './types';

const DAY = 24 * 60 * 60 * 1000;

export interface DetailedPermitRow {
  id: string;
  name: string;
  agency: string;
  status: PermitStatus;
  filingDate: number | null;
  expirationDate: number | null;
  daysLeft: number | null;
  lifecyclePct: number | null;
}

export interface DetailedProjectGroup {
  folderId: string;
  name: string;
  phaseLabel: string | null;
  coord: Project['coord'];
  permitsListId: string | null;
  permits: DetailedPermitRow[];
  totals: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
  };
  earliestExpiration: number | null;
}

export type DetailedFilter = 'all' | 'expiring' | 'active' | 'expired';

function toRow(permit: Permit, now: number): DetailedPermitRow {
  const agency = permit.agencies[0]?.toUpperCase() ?? '—';
  let lifecyclePct: number | null = null;
  let daysLeft: number | null = null;
  if (permit.expirationDate != null) {
    daysLeft = Math.floor((permit.expirationDate - now) / DAY);
    if (permit.filingDate != null && permit.expirationDate > permit.filingDate) {
      const span = permit.expirationDate - permit.filingDate;
      const used = now - permit.filingDate;
      lifecyclePct = Math.max(0, Math.min(100, Math.round((used / span) * 100)));
    }
  }
  return {
    id: permit.id,
    name: permit.permitType ?? permit.name,
    agency,
    status: permit.status,
    filingDate: permit.filingDate,
    expirationDate: permit.expirationDate,
    daysLeft,
    lifecyclePct,
  };
}

function sortRows(rows: DetailedPermitRow[]): DetailedPermitRow[] {
  return [...rows].sort((a, b) => {
    if (a.expirationDate == null && b.expirationDate == null) return 0;
    if (a.expirationDate == null) return 1;
    if (b.expirationDate == null) return -1;
    return a.expirationDate - b.expirationDate;
  });
}

export function buildDetailedGroups(
  projects: Project[],
  now = Date.now(),
): DetailedProjectGroup[] {
  const groups: DetailedProjectGroup[] = [];
  for (const project of projects) {
    if (project.permits.length === 0) continue;
    const rows = sortRows(project.permits.map((p) => toRow(p, now)));
    const totals = {
      total: project.permits.length,
      active: project.permits.filter((p) => p.status === 'active').length,
      expiring: project.permits.filter((p) => p.status === 'expiring').length,
      expired: project.permits.filter((p) => p.status === 'expired').length,
    };
    const earliestExpiration = rows.find((r) => r.expirationDate != null)?.expirationDate ?? null;
    groups.push({
      folderId: project.folderId,
      name: project.name,
      phaseLabel: project.phaseLabel,
      coord: project.coord,
      permitsListId: project.permitsListId,
      permits: rows,
      totals,
      earliestExpiration,
    });
  }
  return groups.sort((a, b) => {
    // Surface projects with expiring/expired permits first, then by earliest expiry.
    const aHot = a.totals.expired * 1000 + a.totals.expiring;
    const bHot = b.totals.expired * 1000 + b.totals.expiring;
    if (aHot !== bHot) return bHot - aHot;
    if (a.earliestExpiration == null && b.earliestExpiration == null) return 0;
    if (a.earliestExpiration == null) return 1;
    if (b.earliestExpiration == null) return -1;
    return a.earliestExpiration - b.earliestExpiration;
  });
}

export function filterGroups(
  groups: DetailedProjectGroup[],
  filter: DetailedFilter,
  search: string,
): DetailedProjectGroup[] {
  const q = search.trim().toLowerCase();
  return groups
    .map((g) => {
      const rows = g.permits.filter((p) => {
        if (filter === 'expiring' && p.status !== 'expiring') return false;
        if (filter === 'active' && p.status !== 'active') return false;
        if (filter === 'expired' && p.status !== 'expired') return false;
        if (q) {
          const hay = `${g.name} ${p.name} ${p.agency}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      if (rows.length === 0) return null;
      return { ...g, permits: rows };
    })
    .filter((g): g is DetailedProjectGroup => g != null);
}

export function countGroups(
  groups: DetailedProjectGroup[],
): Record<DetailedFilter, number> {
  let all = 0;
  let expiring = 0;
  let active = 0;
  let expired = 0;
  for (const g of groups) {
    if (g.permits.length > 0) all += 1;
    if (g.totals.expiring > 0) expiring += 1;
    if (g.totals.active > 0) active += 1;
    if (g.totals.expired > 0) expired += 1;
  }
  return { all, expiring, active, expired };
}
