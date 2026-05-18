import type { Permit, PermitStatus, Project } from './types';

const DAY = 24 * 60 * 60 * 1000;

export interface CalendarPermit {
  id: string;
  name: string;
  permitType: string | null;
  agency: string;
  status: PermitStatus;
  expirationDate: number;
  daysToExpiration: number;
  projectName: string;
  projectFolderId: string;
}

export interface CalendarDay {
  iso: string;
  date: number;
  isToday: boolean;
  permits: CalendarPermit[];
  worstStatus: PermitStatus | null;
}

export interface CalendarMonth {
  label: string;
  year: number;
  month: number;
  leadingBlanks: number;
  days: CalendarDay[];
  expiringCount: number;
}

export interface PermitsCalendar {
  months: CalendarMonth[];
  upcoming: CalendarPermit[];
  totalIn90: number;
}

function localMidnight(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function statusRank(s: PermitStatus): number {
  if (s === 'expired') return 3;
  if (s === 'expiring') return 2;
  return 1;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function flattenPermits(projects: Project[]): {
  permit: Permit;
  project: Project;
}[] {
  const out: { permit: Permit; project: Project }[] = [];
  for (const project of projects) {
    for (const permit of project.permits) {
      out.push({ permit, project });
    }
  }
  return out;
}

function toCalendarPermit(permit: Permit, project: Project): CalendarPermit | null {
  if (permit.expirationDate == null) return null;
  return {
    id: permit.id,
    name: permit.permitType ?? permit.name,
    permitType: permit.permitType,
    agency: permit.agencies[0]?.toUpperCase() ?? '—',
    status: permit.status,
    expirationDate: permit.expirationDate,
    daysToExpiration: permit.daysToExpiration ?? 0,
    projectName: project.name,
    projectFolderId: project.folderId,
  };
}

export function buildPermitsCalendar(
  projects: Project[],
  now = Date.now(),
): PermitsCalendar {
  const today = new Date(now);
  const todayMid = localMidnight(now);
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());

  const byDay = new Map<string, CalendarPermit[]>();
  const all: CalendarPermit[] = [];

  for (const { permit, project } of flattenPermits(projects)) {
    const cp = toCalendarPermit(permit, project);
    if (!cp) continue;
    all.push(cp);

    const exp = new Date(cp.expirationDate);
    const key = dayKey(exp.getFullYear(), exp.getMonth(), exp.getDate());
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(cp);
  }

  // Three calendar months starting with today's month.
  const months: CalendarMonth[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const m = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const year = m.getFullYear();
    const month = m.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = new Date(year, month, 1).getDay(); // 0=Sun

    const days: CalendarDay[] = [];
    let expiringCount = 0;
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = dayKey(year, month, d);
      const permits = byDay.get(key) ?? [];
      let worst: PermitStatus | null = null;
      for (const p of permits) {
        if (!worst || statusRank(p.status) > statusRank(worst)) worst = p.status;
      }
      if (worst === 'expiring' || worst === 'expired') expiringCount += permits.length;
      days.push({
        iso: key,
        date: d,
        isToday: key === todayKey,
        permits,
        worstStatus: worst,
      });
    }

    months.push({
      label: `${MONTH_LABELS[month]} ${year}`,
      year,
      month,
      leadingBlanks,
      days,
      expiringCount,
    });
  }

  // Upcoming list: anything that hasn't expired more than 7 days ago, sorted
  // by expiration date — surfaces the same chronological view as the side
  // panel in the design.
  const cutoffPast = todayMid - 7 * DAY;
  const upcoming = all
    .filter((p) => p.expirationDate >= cutoffPast)
    .sort((a, b) => a.expirationDate - b.expirationDate);

  const horizon = todayMid + 90 * DAY;
  const totalIn90 = all.filter(
    (p) => p.expirationDate >= todayMid && p.expirationDate <= horizon,
  ).length;

  return { months, upcoming, totalIn90 };
}
