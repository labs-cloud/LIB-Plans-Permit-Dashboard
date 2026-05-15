import type { Project } from '@/lib/types';
import { ApprovedPlansCopyButton } from './ApprovedPlansCopyButton';
import { folderUrl, listUrl, taskUrl } from '@/lib/urls';
import { CoordinatorAvatar } from './CoordinatorAvatar';
import { StatusDot } from './StatusDot';

interface Props {
  projects: Project[];
  matrixColumns: string[];
  totalCount: number;
  filterTag?: string | null;
}

const LEGEND: { label: string; color: string; border: string }[] = [
  { label: 'Approved', color: '#C0DD97', border: '1px solid #7FAE52' },
  { label: 'Filed', color: '#B5D4F4', border: '1px solid #5F94CC' },
  { label: 'Waiting on', color: '#FAC775', border: '1px solid #D89724' },
  { label: 'To file', color: '#D3D1C7', border: '1px solid #A8A595' },
  { label: 'To submit', color: '#F1EFE8', border: '1px solid #C7C3B5' },
  {
    label: 'None',
    color: 'var(--color-background-secondary)',
    border: '1px dashed var(--color-border-secondary)',
  },
];

const COL_WIDTH = {
  owner: 36,
  project: 200,
  plan: 100,
  permits: 110,
  copy: 40,
};

function gridTemplate(planCount: number): string {
  return `${COL_WIDTH.owner}px ${COL_WIDTH.project}px repeat(${planCount}, ${COL_WIDTH.plan}px) ${COL_WIDTH.permits}px ${COL_WIDTH.copy}px`;
}

export function PortfolioMatrix({ projects, matrixColumns, totalCount, filterTag }: Props) {
  const template = gridTemplate(matrixColumns.length);

  return (
    <div className="card">
      <div
        className="matrix-title-row"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 16,
        }}
      >
        <div className="section-title" style={{ margin: 0 }}>
          <i className="ti ti-grid-dots" style={{ fontSize: 16 }} /> Portfolio matrix
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
          Showing {projects.length} of {totalCount}
          {filterTag ? ` · ${filterTag}` : ''}
          {matrixColumns.length > 8 ? ' · scroll horizontally for more plan types →' : ''}
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

      <div
        className="matrix-scroll"
        style={{
          overflowX: 'auto',
          borderRadius: 'var(--border-radius-md)',
          border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <div style={{ minWidth: 'max-content' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: template,
              gap: 6,
              padding: '8px 10px',
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              background: 'var(--color-background-secondary)',
              alignItems: 'end',
            }}
          >
            <div>Owner</div>
            <div>Project</div>
            {matrixColumns.map((col) => (
              <div
                key={col}
                style={{
                  textAlign: 'center',
                  whiteSpace: 'normal',
                  lineHeight: 1.15,
                  wordBreak: 'break-word',
                }}
                title={col}
              >
                {col}
              </div>
            ))}
            <div style={{ textAlign: 'right' }}>Permits</div>
            <div style={{ textAlign: 'center' }} title="Copy Approved Plans Link">
              Plans
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">No projects match these filters</div>
          ) : (
            projects.map((project) => (
              <div
                key={project.folderId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: template,
                  gap: 6,
                  padding: '8px 10px',
                  fontSize: 12,
                  alignItems: 'center',
                  borderTop: '0.5px solid var(--color-border-tertiary)',
                }}
              >
                <div>
                  <CoordinatorAvatar coord={project.coord} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <a
                    href={folderUrl(project.folderId)}
                    target="_blank"
                    rel="noopener"
                    title={`Open ${project.name} in ClickUp`}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'inline-block',
                      maxWidth: '100%',
                    }}
                  >
                    {project.name}
                  </a>
                </div>
                {matrixColumns.map((col) => {
                  const plan = project.plans.find((p) => p.matrixColumn === col);
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
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ApprovedPlansCopyButton variant="icon" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
