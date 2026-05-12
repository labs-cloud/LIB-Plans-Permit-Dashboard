import type { Project, MatrixColumn } from '@/lib/types';
import { MATRIX_COLUMNS } from '@/lib/plan-type-map';
import { COORD_BY_ID } from '@/lib/constants';
import { folderUrl, taskUrl, listUrl } from '@/lib/urls';
import { PLAN_STATUS_TABLE } from '@/lib/status-map';
import { CoordinatorAvatar } from './CoordinatorAvatar';

interface Props {
  project: Project;
}

function findPlan(project: Project, column: MatrixColumn) {
  return project.plans.find((p) => p.matrixColumn === column) ?? null;
}

export function ProjectCard({ project }: Props) {
  const coordMeta = COORD_BY_ID[project.coord];

  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <CoordinatorAvatar coord={project.coord} />
        <div style={{ flex: 1 }}>
          <a
            href={folderUrl(project.folderId)}
            target="_blank"
            rel="noopener"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            {project.name}
          </a>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {project.meta ? ` · ${project.meta}` : ''}
            {project.phaseLabel ? ` · ${project.phaseLabel}` : ''} ·{' '}
          </span>
          <span style={{ fontSize: 11, color: coordMeta.color }}>{coordMeta.name}</span>
        </div>
        {project.alert ? (
          <div style={{ fontSize: 11, color: project.alert.color }}>{project.alert.text}</div>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {MATRIX_COLUMNS.map((col) => {
          const plan = findPlan(project, col);
          if (!plan || !plan.status) return null;
          const style = PLAN_STATUS_TABLE[plan.status];
          return (
            <a
              key={col}
              href={taskUrl(plan.id)}
              target="_blank"
              rel="noopener"
              className="pill"
              style={{ background: style.bg, color: style.fg }}
            >
              <strong>{col}</strong> {style.label}
            </a>
          );
        })}
        {project.plans
          .filter((p) => !p.matrixColumn && p.status)
          .map((plan) => {
            const style = plan.status ? PLAN_STATUS_TABLE[plan.status] : null;
            if (!style) return null;
            return (
              <a
                key={plan.id}
                href={taskUrl(plan.id)}
                target="_blank"
                rel="noopener"
                className="pill"
                style={{ background: style.bg, color: style.fg }}
                title={plan.planType ?? plan.name}
              >
                <strong>{plan.planType ?? plan.name}</strong> {style.label}
              </a>
            );
          })}
        {project.permitsListId && project.permitsSummary.total > 0 ? (
          <a
            href={listUrl(project.permitsListId)}
            target="_blank"
            rel="noopener"
            className="pill"
            style={{ background: '#F1EFE8', color: project.permitsSummary.color }}
          >
            <strong>Permits</strong> {project.permitsSummary.label.replace('● ', '')}
          </a>
        ) : null}
      </div>
    </div>
  );
}
