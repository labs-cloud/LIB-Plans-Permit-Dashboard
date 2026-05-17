import type { Plan, Project, StatusKey } from '@/lib/types';
import { COORD_BY_ID } from '@/lib/constants';
import { folderUrl, listUrl } from '@/lib/urls';
import { ApprovedPlansCopyButton } from './ApprovedPlansCopyButton';
import { CoordinatorAvatar } from './CoordinatorAvatar';
import { FilingChip, PermitsChip } from './FilingChip';
import type { ChipStyle, DetailedLayout } from './ViewSettings';

interface Props {
  project: Project;
  layout: DetailedLayout;
  chipStyle: ChipStyle;
}

const TRIAGE_RANK: Record<StatusKey, number> = {
  WO: 0,
  FI: 1,
  TF: 2,
  TS: 3,
  AP: 4,
};

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

function sortedPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const aRank = a.status ? TRIAGE_RANK[a.status] : 5;
    const bRank = b.status ? TRIAGE_RANK[b.status] : 5;
    return aRank - bRank;
  });
}

interface Lane {
  id: 'urgent' | 'flight' | 'queue' | 'done';
  label: string;
  accent: string;
  match: (p: Plan) => boolean;
}

const LANES: Lane[] = [
  {
    id: 'urgent',
    label: 'Needs attention',
    accent: 'var(--warn-strong)',
    match: (p) => p.status === 'WO',
  },
  {
    id: 'flight',
    label: 'In flight with agency',
    accent: 'var(--info-strong)',
    match: (p) => p.status === 'FI',
  },
  {
    id: 'queue',
    label: 'Drafting · to submit',
    accent: 'var(--color-text-tertiary)',
    match: (p) => p.status === 'TF' || p.status === 'TS',
  },
  {
    id: 'done',
    label: 'Approved',
    accent: 'var(--good-strong)',
    match: (p) => p.status === 'AP',
  },
];

export function ProjectCard({ project, layout, chipStyle }: Props) {
  const coordMeta = COORD_BY_ID[project.coord];
  const { count: waitingCount, maxDays: waitingDays } = waitingMeta(project);
  const waitingActive = waitingCount > 0;
  const metaBits: string[] = [];
  if (project.meta) metaBits.push(project.meta);
  if (project.phaseLabel) metaBits.push(project.phaseLabel);

  const permitsHref =
    project.permitsListId && project.permitsSummary.total > 0
      ? listUrl(project.permitsListId)
      : null;

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
      ) : layout === 'C' ? (
        <LanesBody
          plans={project.plans}
          chipStyle={chipStyle}
          permits={
            permitsHref ? (
              <PermitsChip
                label={project.permitsSummary.label}
                count={project.permitsSummary.total}
                href={permitsHref}
                chipStyle={chipStyle}
              />
            ) : null
          }
        />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(layout === 'B' ? sortedPlans(project.plans) : project.plans).map((plan) => (
            <FilingChip key={plan.id} plan={plan} chipStyle={chipStyle} />
          ))}
          {permitsHref ? (
            <PermitsChip
              label={project.permitsSummary.label}
              count={project.permitsSummary.total}
              href={permitsHref}
              chipStyle={chipStyle}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

interface LanesBodyProps {
  plans: Plan[];
  chipStyle: ChipStyle;
  permits: React.ReactNode;
}

function LanesBody({ plans, chipStyle, permits }: LanesBodyProps) {
  const buckets = LANES.map((lane) => ({
    lane,
    plans: plans.filter(lane.match),
  })).filter((b) => b.plans.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {buckets.map((b, idx) => {
        const isUrgent = b.lane.id === 'urgent';
        return (
          <div
            key={b.lane.id}
            style={{
              padding: isUrgent ? '12px 14px 6px' : 0,
              margin: isUrgent ? `${idx === 0 ? 0 : 4}px -14px 0` : 0,
              borderRadius: 'var(--border-radius-md)',
              borderLeft: isUrgent ? '2px solid var(--warn-strong)' : undefined,
              background: isUrgent
                ? 'linear-gradient(180deg, rgba(250,199,117,0.08) 0%, transparent 60%)'
                : 'transparent',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: isUrgent ? 'var(--warn-strong)' : 'var(--color-text-tertiary)',
                marginBottom: 8,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: b.lane.id === 'queue' ? 2 : '50%',
                  background: b.lane.accent,
                  display: 'inline-block',
                }}
              />
              {b.lane.label}
              <span
                style={{
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  fontWeight: 400,
                  color: 'var(--color-text-tertiary)',
                }}
              >
                · {b.plans.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {b.plans.map((plan) => (
                <FilingChip key={plan.id} plan={plan} chipStyle={chipStyle} />
              ))}
            </div>
          </div>
        );
      })}
      {permits ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{permits}</div>
      ) : null}
    </div>
  );
}
