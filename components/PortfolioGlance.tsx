'use client';

import type { Project } from '@/lib/types';
import { folderUrl } from '@/lib/urls';
import { PLAN_STATUS_TABLE } from '@/lib/status-map';

interface Props {
  projects: Project[];
  totalCount: number;
  onSwitchToDetailed: () => void;
}

interface Dot {
  folderId: string;
  projectName: string;
  bg: string;
  border: string;
  label: string;
}

// One dot per project — colored by the project's most-stuck plan status:
// Waiting on > To file > To submit > Filed > Approved (skipped — quiet baseline).
function dotFor(project: Project): Dot {
  const priorityOrder: Array<keyof typeof PLAN_STATUS_TABLE> = ['WO', 'TF', 'TS', 'FI', 'AP'];
  for (const status of priorityOrder) {
    if (project.plans.some((p) => p.status === status)) {
      const meta = PLAN_STATUS_TABLE[status];
      return {
        folderId: project.folderId,
        projectName: project.name,
        bg: meta.bg,
        border: meta.border,
        label: `${project.name} · ${meta.label}`,
      };
    }
  }
  return {
    folderId: project.folderId,
    projectName: project.name,
    bg: 'var(--color-background-secondary)',
    border: 'var(--color-border-secondary)',
    label: `${project.name} · no plans`,
  };
}

export function PortfolioGlance({ projects, totalCount, onSwitchToDetailed }: Props) {
  const dots = projects.map(dotFor);
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div
        className="section-title"
        style={{
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <i className="ti ti-grid-dots" style={{ fontSize: 16 }} /> Portfolio at a glance
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            fontWeight: 400,
          }}
        >
          {projects.length} of {totalCount}
        </span>
      </div>

      {dots.length === 0 ? (
        <div className="empty-state">No projects match these filters</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(11, 1fr)',
            gap: 5,
            padding: '6px 0',
          }}
        >
          {dots.map((dot) => (
            <a
              key={dot.folderId}
              href={folderUrl(dot.folderId)}
              target="_blank"
              rel="noopener"
              title={dot.label}
              className="dot"
              style={{
                background: dot.bg,
                border: `1px solid ${dot.border}`,
                aspectRatio: '1 / 1',
                width: '100%',
                height: 'auto',
              }}
            />
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          marginTop: 10,
        }}
      >
        Switch to{' '}
        <button
          type="button"
          onClick={onSwitchToDetailed}
          style={{
            color: 'var(--color-text-info)',
            cursor: 'pointer',
            background: 'transparent',
            padding: 0,
            font: 'inherit',
            textDecoration: 'underline',
          }}
        >
          Detailed view
        </button>{' '}
        for project-level scope.
      </div>
    </div>
  );
}
