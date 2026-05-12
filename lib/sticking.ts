import type { Project, StickingItem } from './types';

const DAY = 24 * 60 * 60 * 1000;

const SEVERITY_STYLE: Record<1 | 2 | 3 | 4 | 5, { color: string; bg: string; text: string }> = {
  1: { color: '#791F1F', bg: '#FCEBEB', text: '#501313' },
  2: { color: '#BA7517', bg: '#FAEEDA', text: '#412402' },
  3: { color: '#854F0B', bg: '#FAEEDA', text: '#412402' },
  4: { color: '#854F0B', bg: '#FAEEDA', text: '#412402' },
  5: { color: '#BA7517', bg: '#FAEEDA', text: '#412402' },
};

interface Candidate {
  severity: 1 | 2 | 3 | 4 | 5;
  daysStuck: number;
  taskId: string;
  text: string;
  project: Project;
}

export function computeSticking(projects: Project[], now = Date.now()): StickingItem[] {
  const candidates: Candidate[] = [];

  for (const project of projects) {
    for (const permit of project.permits) {
      if (permit.status === 'expired') {
        const days = permit.daysToExpiration != null ? Math.abs(permit.daysToExpiration) : 0;
        candidates.push({
          severity: 1,
          daysStuck: days,
          taskId: permit.id,
          text: `${permit.permitType ?? 'Permit'} expired${days > 0 ? ` ${days}d ago` : ''}`,
          project,
        });
      } else if (permit.status === 'expiring' && permit.daysToExpiration != null) {
        if (permit.daysToExpiration <= 7) {
          candidates.push({
            severity: 2,
            daysStuck: 7 - permit.daysToExpiration,
            taskId: permit.id,
            text: `${permit.permitType ?? 'Permit'} expires in ${permit.daysToExpiration}d`,
            project,
          });
        } else if (permit.daysToExpiration <= 30) {
          candidates.push({
            severity: 4,
            daysStuck: 30 - permit.daysToExpiration,
            taskId: permit.id,
            text: `${permit.permitType ?? 'Permit'} expires in ${permit.daysToExpiration}d`,
            project,
          });
        }
      }
    }

    for (const plan of project.plans) {
      if (plan.status !== 'WO') continue;
      const days = Math.floor((now - plan.dateUpdated) / DAY);
      if (days > 7) {
        candidates.push({
          severity: 3,
          daysStuck: days,
          taskId: plan.id,
          text: `${plan.planType ?? plan.name} waiting on · ${days}d`,
          project,
        });
      } else if (days > 3) {
        candidates.push({
          severity: 5,
          daysStuck: days,
          taskId: plan.id,
          text: `${plan.planType ?? plan.name} waiting on · ${days}d`,
          project,
        });
      }
    }
  }

  candidates.sort((a, b) => a.severity - b.severity || b.daysStuck - a.daysStuck);

  return candidates.slice(0, 5).map<StickingItem>((c) => ({
    taskId: c.taskId,
    projectName: c.project.name,
    folderId: c.project.folderId,
    coord: c.project.coord,
    severity: c.severity,
    color: SEVERITY_STYLE[c.severity].color,
    bg: SEVERITY_STYLE[c.severity].bg,
    text: c.text,
    daysStuck: c.daysStuck,
  }));
}
