import type { Project } from '@/lib/types';
import { COORD_BY_ID } from '@/lib/constants';
import { folderUrl, taskUrl, listUrl } from '@/lib/urls';
import { PLAN_STATUS_TABLE } from '@/lib/status-map';
import { ApprovedPlansCopyButton } from './ApprovedPlansCopyButton';
import { CoordinatorAvatar } from './CoordinatorAvatar';

interface Props {
  project: Project;
}

const UNMAPPED_STYLE = {
  bg: '#F1EFE8',
  fg: '#5F5E5A',
  border: '#C7C3B5',
};

export function ProjectCard({ project }: Props) {
  const coordMeta = COORD_BY_ID[project.coord];

  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <CoordinatorAvatar coord={project.coord} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <a
            href={folderUrl(project.folderId)}
            target="_blank"
            rel="noopener"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            {project.name}
          </a>
          <ApprovedPlansCopyButton variant="button" />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {project.meta ? `${project.meta} · ` : ''}
            {project.phaseLabel ? `${project.phaseLabel} · ` : ''}
            <span style={{ color: coordMeta.color }}>{coordMeta.name}</span>
          </span>
        </div>
        {project.alert ? (
          <div style={{ fontSize: 11, color: project.alert.color }}>{project.alert.text}</div>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {project.plans.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
            No plans in ClickUp yet
          </div>
        ) : (
          project.plans.map((plan) => {
            const style = plan.status ? PLAN_STATUS_TABLE[plan.status] : null;
            const label = plan.matrixColumn ?? plan.planType ?? plan.name;
            const statusLabel = style?.label ?? plan.rawStatus ?? '—';
            const bg = style?.bg ?? UNMAPPED_STYLE.bg;
            const fg = style?.fg ?? UNMAPPED_STYLE.fg;
            const border = style?.border ?? UNMAPPED_STYLE.border;
            return (
              <a
                key={plan.id}
                href={taskUrl(plan.id)}
                target="_blank"
                rel="noopener"
                className="pill"
                style={{ background: bg, color: fg, border: `1px solid ${border}` }}
                title={plan.planType ?? plan.name}
              >
                <strong>{label}</strong> {statusLabel}
              </a>
            );
          })
        )}
        {project.permitsListId && project.permitsSummary.total > 0 ? (
          <a
            href={listUrl(project.permitsListId)}
            target="_blank"
            rel="noopener"
            className="pill"
            style={{
              background: '#F1EFE8',
              color: project.permitsSummary.color,
              border: `1px solid ${project.permitsSummary.color}`,
            }}
          >
            <strong>Permits</strong> {project.permitsSummary.label.replace('● ', '')}
          </a>
        ) : null}
      </div>
    </div>
  );
}
