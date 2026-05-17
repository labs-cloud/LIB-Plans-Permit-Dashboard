'use client';

import type { Project } from '@/lib/types';
import { folderUrl } from '@/lib/urls';
import { PLAN_STATUS_TABLE } from '@/lib/status-map';

interface Props {
  projects: Project[];
  totalCount: number;
  onSwitchToDetailed: () => void;
}

interface Tile {
  folderId: string;
  projectName: string;
  bg: string;
  border: string;
  accent: string;
  statusLabel: string;
  approvedCount: number;
  totalPlans: number;
  percent: number;
}

// Tile color reflects the project's most-stuck plan status:
// Waiting on > To file > To submit > Filed > Approved.
function tileFor(project: Project): Tile {
  const priorityOrder: Array<keyof typeof PLAN_STATUS_TABLE> = ['WO', 'TF', 'TS', 'FI', 'AP'];
  const totalPlans = project.plans.filter((p) => p.status != null).length;
  const approvedCount = project.plans.filter((p) => p.status === 'AP').length;
  const percent = totalPlans === 0 ? 0 : Math.round((approvedCount / totalPlans) * 100);

  for (const status of priorityOrder) {
    if (project.plans.some((p) => p.status === status)) {
      const meta = PLAN_STATUS_TABLE[status];
      return {
        folderId: project.folderId,
        projectName: project.name,
        bg: meta.bg,
        border: meta.border,
        accent: meta.fg,
        statusLabel: meta.label,
        approvedCount,
        totalPlans,
        percent,
      };
    }
  }
  return {
    folderId: project.folderId,
    projectName: project.name,
    bg: 'var(--color-background-secondary)',
    border: 'var(--color-border-secondary)',
    accent: 'var(--color-text-tertiary)',
    statusLabel: 'No plans',
    approvedCount: 0,
    totalPlans: 0,
    percent: 0,
  };
}

export function PortfolioGlance({ projects, totalCount, onSwitchToDetailed }: Props) {
  const tiles = projects.map(tileFor);
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
          {projects.length} of {totalCount} · % approved
        </span>
      </div>

      {tiles.length === 0 ? (
        <div className="empty-state">No projects match these filters</div>
      ) : (
        <div
          className="glance-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 6,
          }}
        >
          {tiles.map((tile) => (
            <a
              key={tile.folderId}
              href={folderUrl(tile.folderId)}
              target="_blank"
              rel="noopener"
              title={`${tile.projectName} · ${tile.approvedCount}/${tile.totalPlans} approved · ${tile.statusLabel}`}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 4,
                padding: '8px 10px 10px',
                background: tile.bg,
                border: `0.5px solid ${tile.border}`,
                borderRadius: 6,
                color: tile.accent,
                minHeight: 56,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tile.projectName}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {tile.totalPlans === 0 ? '—' : `${tile.percent}%`}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    opacity: 0.75,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {tile.totalPlans === 0
                    ? 'no plans'
                    : `${tile.approvedCount}/${tile.totalPlans}`}
                </span>
              </div>
              {/* progress underline */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  height: 2,
                  width: `${tile.percent}%`,
                  background: tile.accent,
                  opacity: 0.55,
                }}
              />
            </a>
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          marginTop: 12,
        }}
      >
        Color = stickiest plan status · bar = % approved · click any tile to open the project ·{' '}
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
        </button>
      </div>
    </div>
  );
}
