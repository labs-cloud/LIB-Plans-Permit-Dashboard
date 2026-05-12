import type { KpiStripData, PermitsPanelData, Project } from './types';

const DAY = 24 * 60 * 60 * 1000;

const AGENCY_COLORS: Record<string, string> = {
  DOB: '#534AB7',
  DOT: '#5F5E5A',
  FDNY: '#A32D2D',
  DEP: '#1D9E75',
  FEMA: '#185fa5',
  PARKS: '#3B6D11',
  MTA: '#854F0B',
  'NYS LAND SURVEYOR': '#0F6E56',
};

export function computeKpis(projects: Project[], now = Date.now()): KpiStripData {
  let filingsInFlight = 0;
  let approved7d = 0;
  let waitingOn = 0;
  let expiring30d = 0;
  let expired = 0;

  for (const project of projects) {
    for (const plan of project.plans) {
      if (plan.status === 'FI' || plan.status === 'WO' || plan.status === 'TF') filingsInFlight += 1;
      if (plan.status === 'AP' && now - plan.dateUpdated <= 7 * DAY) approved7d += 1;
      if (plan.status === 'WO') waitingOn += 1;
    }
    for (const permit of project.permits) {
      if (permit.status === 'expiring') expiring30d += 1;
      if (permit.status === 'expired') expired += 1;
    }
  }

  return { filingsInFlight, approved7d, waitingOn, expiring30d, expired };
}

export function computePermitsPanel(projects: Project[], now = Date.now()): PermitsPanelData {
  let active = 0;
  let expired = 0;
  let expiring30d = 0;
  const projectsWithActive = new Set<string>();
  const projectsWithExpiring30d = new Set<string>();
  const timeline = { overdue: 0, d0_7: 0, d8_30: 0, d31_60: 0, d61_90: 0 };
  const agencyCount = new Map<string, number>();
  const attention: PermitsPanelData['attention'] = [];

  for (const project of projects) {
    for (const permit of project.permits) {
      if (permit.status === 'active') {
        active += 1;
        projectsWithActive.add(project.folderId);
      }
      if (permit.status === 'expired') {
        expired += 1;
        timeline.overdue += 1;
        attention.push({
          taskId: permit.id,
          projectName: project.name,
          folderId: project.folderId,
          coord: project.coord,
          text: `${permit.permitType ?? 'Permit'} expired`,
          color: '#791F1F',
          bg: '#FCEBEB',
        });
      } else if (permit.daysToExpiration != null && permit.daysToExpiration >= 0) {
        const d = permit.daysToExpiration;
        if (d <= 7) timeline.d0_7 += 1;
        else if (d <= 30) timeline.d8_30 += 1;
        else if (d <= 60) timeline.d31_60 += 1;
        else if (d <= 90) timeline.d61_90 += 1;
      }
      if (permit.status === 'expiring') {
        expiring30d += 1;
        projectsWithExpiring30d.add(project.folderId);
        if (attention.length < 12 && (permit.daysToExpiration ?? 31) <= 30) {
          attention.push({
            taskId: permit.id,
            projectName: project.name,
            folderId: project.folderId,
            coord: project.coord,
            text: `${permit.permitType ?? 'Permit'} expires in ${permit.daysToExpiration}d`,
            color: '#BA7517',
            bg: '#FAEEDA',
          });
        }
      }
      for (const agency of permit.agencies) {
        const norm = agency.trim().toUpperCase();
        agencyCount.set(norm, (agencyCount.get(norm) ?? 0) + 1);
      }
    }
  }

  const byAgency = Array.from(agencyCount.entries())
    .map(([agency, count]) => ({
      agency,
      count,
      color: AGENCY_COLORS[agency] ?? '#5F5E5A',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const allPermitsListIds = projects
    .map((p) => p.permitsListId)
    .filter((id): id is string => !!id);

  return {
    active,
    activeProjects: projectsWithActive.size,
    expiring30d,
    expiring30dProjects: projectsWithExpiring30d.size,
    expired,
    timeline,
    byAgency,
    attention: attention.slice(0, 8),
    allPermitsListIds,
  };
}
