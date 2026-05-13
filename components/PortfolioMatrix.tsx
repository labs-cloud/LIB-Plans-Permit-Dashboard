import type { Project, MatrixColumn } from '@/lib/types';
import { MATRIX_COLUMNS } from '@/lib/plan-type-map';
import { folderUrl, listUrl, taskUrl } from '@/lib/urls';
import { CoordinatorAvatar } from './CoordinatorAvatar';
import { StatusDot } from './StatusDot';

interface Props {
  projects: Project[];
  totalCount: number;
  filterTag?: string | null;
}

const LEGEND: { label: string; color: string; border: string }[] = [
  { label: 'Approved', color: '#C0DD97', border: '1px solid #7FAE52' },
  { label: 'Filed', color: '#B5D4F4', border: '1px solid #5F94CC' },
  { label: 'Waiting on', color: '#FAC775', border: '1px solid #D89724' },
  { label: 'To file', color: '#D3D1C7', border: '1px solid #A8A595' },
  { label: 'To submit', color: '#F1EFE8', border: '1px solid #C7C3B5' },
  { label: 'None', color: 'var(--color-background-secondary)', border: '1px dashed var(--color-border-secondary)' },
];

function findPlanForColumn(project: Project, column: MatrixColumn) {
  return project.plans.find((p) => p.matrixColumn === column && p.status) ?? null;
}

export function PortfolioMatrix({ projects, totalCount, filterTag }: Props) {
  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div className="section-title" style={{ margin: 0 }}>
          <i className="ti ti-grid-dots" style={{ fontSize: 16 }} /> Portfolio matrix
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          Showing {projects.length} of {totalCount}
          {filterTag ? ` · ${filterTag}` : ''}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        {LEGEND.map((l) => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span className="dot" style={{ background: l.color, border: l.border }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="matrix-header">
        <div>Owner</div>
        <div>Project</div>
        {MATRIX_COLUMNS.map((c) => (
          <div key={c} style={{ textAlign: 'center' }}>
            {c}
          </div>
        ))}
        <div style={{ textAlign: 'right' }}>Permits</div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">No projects match these filters</div>
      ) : (
        <div>
          {projects.map((project) => (
            <div key={project.folderId} className="matrix-row">
              <div>
                <CoordinatorAvatar coord={project.coord} />
              </div>
              <div>
                <a
                  href={folderUrl(project.folderId)}
                  target="_blank"
                  rel="noopener"
                  title={`Open ${project.name} in ClickUp`}
                >
                  {project.name}
                </a>
              </div>
              {MATRIX_COLUMNS.map((col) => {
                const plan = findPlanForColumn(project, col);
                const status = project.matrix[col] ?? null;
                if (plan) {
                  return (
                    <div key={col} style={{ textAlign: 'center' }}>
                      <a
                        href={taskUrl(plan.id)}
                        target="_blank"
                        rel="noopener"
                        title={`${col} · ${plan.rawStatus || 'no status'}`}
                      >
                        <StatusDot status={status} />
                      </a>
                    </div>
                  );
                }
                return (
                  <div key={col} style={{ textAlign: 'center' }}>
                    <StatusDot status={null} />
                  </div>
                );
              })}
              <div
                style={{
                  textAlign: 'right',
                  fontSize: 11,
                  color: project.permitsSummary.color,
                }}
              >
                {project.permitsListId && project.permitsSummary.total > 0 ? (
                  <a
                    href={listUrl(project.permitsListId)}
                    target="_blank"
                    rel="noopener"
                    style={{ color: 'inherit' }}
                  >
                    {project.permitsSummary.label}
                  </a>
                ) : (
                  project.permitsSummary.label
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
