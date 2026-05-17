import type { Plan, Project, StatusKey } from '@/lib/types';
import { COORD_BY_ID } from '@/lib/constants';
import { folderUrl, listUrl, taskUrl } from '@/lib/urls';
import { ApprovedPlansCopyButton } from './ApprovedPlansCopyButton';
import { CoordinatorAvatar } from './CoordinatorAvatar';

interface Props {
  project: Project;
}

// Solid-chip palette per the A2 design: tinted background + matching ink.
const CHIP_STYLE: Record<StatusKey, { bg: string; fg: string; statusLabel: string }> = {
  AP: { bg: 'var(--st-ap-bg)', fg: 'var(--st-ap-fg)', statusLabel: 'Approved' },
  FI: { bg: 'var(--st-fi-bg)', fg: 'var(--st-fi-fg)', statusLabel: 'submitted' },
  WO: { bg: 'var(--st-wo-bg)', fg: 'var(--st-wo-fg)', statusLabel: 'Waiting on' },
  TF: { bg: 'var(--st-tf-bg)', fg: 'var(--st-tf-fg)', statusLabel: 'To file' },
  TS: { bg: 'var(--st-ts-bg)', fg: 'var(--st-ts-fg)', statusLabel: 'To submit' },
};

const UNMAPPED_CHIP = {
  bg: 'var(--color-background-secondary)',
  fg: 'var(--color-text-secondary)',
};

// Expand the ClickUp short codes ("SP - Sprinkler") into the full word.
const FULL_NAME: Record<string, string> = {
  'SP - Sprinkler': 'Sprinkler',
  'MH - Mechanical': 'Mechanical',
  'CC - Cross Connection': 'Cross Connection',
  'SD - Standpipe': 'Standpipe',
  'EN - Energy': 'Energy',
  'ED - Electrical': 'Electrical',
  'PL - Plumbing': 'Plumbing',
  SOE: 'Support of Excavation',
  BPP: 'Builders Pavement',
  'Arch Survey': 'Architectural Survey',
  'ID Drawings': 'Identification Drawings',
  'EES Plan': 'Energy Efficiency Standards',
};

function displayName(raw: string): string {
  if (FULL_NAME[raw]) return FULL_NAME[raw];
  // Generic "XX - Name" → "Name" fallback.
  const match = /^[A-Z]{2,4}\s+-\s+(.*)$/.exec(raw);
  return match ? match[1] : raw;
}

function planLabel(plan: Plan): string {
  const raw = plan.planType ?? plan.matrixColumn ?? plan.name;
  return displayName(raw);
}

const DAY = 24 * 60 * 60 * 1000;

function waitingMeta(project: Project): { count: number; maxDays: number } {
  const now = Date.now();
  let count = 0;
  let maxDays = 0;
  for (const plan of project.plans) {
    if (plan.status !== 'WO') continue;
    count += 1;
    const days = Math.max(0, Math.floor((now - plan.dateUpdated) / DAY));
    if (days > maxDays) maxDays = days;
  }
  return { count, maxDays };
}

export function ProjectCard({ project }: Props) {
  const coordMeta = COORD_BY_ID[project.coord];
  const { count: waitingCount, maxDays: waitingDays } = waitingMeta(project);
  const waitingActive = waitingCount > 0;
  const metaBits: string[] = [];
  if (project.meta) metaBits.push(project.meta);
  if (project.phaseLabel) metaBits.push(project.phaseLabel);

  return (
    <div
      className="card"
      style={{
        padding: '16px 18px 18px',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
      }}
    >
      <div
        className="project-card-head"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <CoordinatorAvatar coord={project.coord} size={30} fontSize={11} />
        <a
          href={folderUrl(project.folderId)}
          target="_blank"
          rel="noopener"
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.005em',
            color: 'var(--color-text-primary)',
          }}
        >
          {project.name}
        </a>
        <ApprovedPlansCopyButton variant="button" />
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {metaBits.length > 0 ? `${metaBits.join(' · ')} · ` : ''}
          <span style={{ color: coordMeta.color }}>{coordMeta.name}</span>
        </span>
        <span
          className="pill"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            padding: '5px 12px',
            borderRadius: 999,
            background: waitingActive ? 'var(--warn-bg)' : 'var(--good-bg)',
            color: waitingActive ? 'var(--warn-strong)' : 'var(--good-fg)',
          }}
        >
          <i
            className={`ti ${waitingActive ? 'ti-alert-triangle' : 'ti-check'}`}
            style={{ fontSize: 12 }}
          />
          {waitingActive
            ? `${waitingCount} waiting on${waitingDays > 0 ? ` · ${waitingDays}d` : ''}`
            : 'on track'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {project.plans.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              fontStyle: 'italic',
            }}
          >
            No plans in ClickUp yet
          </div>
        ) : (
          project.plans.map((plan) => {
            const palette = plan.status ? CHIP_STYLE[plan.status] : null;
            const bg = palette?.bg ?? UNMAPPED_CHIP.bg;
            const fg = palette?.fg ?? UNMAPPED_CHIP.fg;
            const statusLabel = palette?.statusLabel ?? plan.rawStatus ?? '—';
            const isUrgent = plan.status === 'WO';
            return (
              <a
                key={plan.id}
                href={taskUrl(plan.id)}
                target="_blank"
                rel="noopener"
                title={plan.planType ?? plan.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: bg,
                  color: fg,
                  fontSize: 12.5,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  whiteSpace: 'nowrap',
                }}
              >
                {planLabel(plan)}
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: isUrgent ? 700 : 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.11em',
                    color: fg,
                    opacity: isUrgent ? 0.85 : 0.6,
                    lineHeight: 1,
                  }}
                >
                  {statusLabel}
                </span>
              </a>
            );
          })
        )}
        {project.permitsListId && project.permitsSummary.total > 0 ? (
          <a
            href={listUrl(project.permitsListId)}
            target="_blank"
            rel="noopener"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'var(--good-bg)',
              color: 'var(--good-fg)',
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              whiteSpace: 'nowrap',
            }}
          >
            Permits
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.11em',
                color: 'var(--good-fg)',
                opacity: 0.7,
                lineHeight: 1,
              }}
            >
              {project.permitsSummary.label.replace('● ', '')}
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
