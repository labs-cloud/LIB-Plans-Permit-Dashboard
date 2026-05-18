'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { COORD_BY_ID } from '@/lib/constants';
import type { Plan, Project, StatusKey } from '@/lib/types';
import { folderUrl, taskUrl } from '@/lib/urls';

type StatusCode = 'ap' | 'fi' | 'wo' | 'tf' | 'ts';

const STATUS_LABEL: Record<StatusCode, string> = {
  ap: 'AP',
  fi: 'FI',
  wo: 'WO',
  tf: 'TF',
  ts: 'TS',
};

const STATUS_NAME: Record<StatusCode, string> = {
  ap: 'Approved',
  fi: 'Filed',
  wo: 'Waiting on',
  tf: 'To file',
  ts: 'To submit',
};

// Most-urgent-first ordering. Used when a (plan × project) cell has multiple
// filings — display the worst (smallest priority) status.
const STATUS_PRIORITY: Record<StatusCode, number> = {
  wo: 0,
  fi: 1,
  tf: 2,
  ts: 3,
  ap: 4,
};

function toCode(status: StatusKey | null): StatusCode | null {
  if (!status) return null;
  return status.toLowerCase() as StatusCode;
}

function worst(arr: StatusCode[]): StatusCode {
  return arr.slice().sort((a, b) => STATUS_PRIORITY[a] - STATUS_PRIORITY[b])[0];
}

// Plan-type grouping for the matrix rows. Plan-Type names are matched
// case-insensitively against the curated lists below; anything that's not
// in either list lands in "Plans" by default (so the matrix never silently
// drops a plan type).
const PLAN_GROUPS: { id: string; label: string; plans: string[] }[] = [
  {
    id: 'plans',
    label: 'Plans',
    plans: [
      'Architectural',
      'Structural',
      'Foundation',
      'Plumbing',
      'PL - Plumbing',
      'MH - Mechanical',
      'Mechanical',
      'EN - Energy',
      'Energy',
      'ED - Electrical',
      'Electrical',
      'Fire Alarm',
      'SP - Sprinkler',
      'Sprinkler System',
      'Sprinkler',
      'SD - Standpipe',
      'Standpipe',
      'CC - Cross Connection',
      'Cross Connection',
      'Site Safety Plan',
      'SOE',
      'EES Plan',
      'BPP',
      'Exhibits',
      'ID Drawings',
      'Fence',
      'Curb Cut',
      'Street Tree Plan',
    ],
  },
  {
    id: 'surveys',
    label: 'Surveys and Reports',
    plans: [
      'Stakeout Survey',
      'Arch Survey',
      'Pre Construction Survey',
      'Pre-Construction Survey',
      'Geo Tech Report',
      'Geotechnical Report',
    ],
  },
];

interface PlanIndex {
  // canonical plan-type label → group id
  groupOf: Map<string, string>;
  // group id → ordered list of plan-type labels that appear in the data
  plansByGroup: Map<string, string[]>;
  // project folderId → (plan-type → statuses[])
  byProject: Map<string, Map<string, StatusCode[]>>;
  // every plan-type label seen, ordered as in PLAN_GROUPS then alpha for extras
  uniquePlans: string[];
  // Plan tasks behind each (project, plan-type) cell — first one wins for click-through
  taskByCell: Map<string, Map<string, string>>;
}

function buildPlanIndex(projects: Project[]): PlanIndex {
  const groupOf = new Map<string, string>();
  const declaredOrder = new Map<string, number>();
  PLAN_GROUPS.forEach((g) => {
    g.plans.forEach((p) => {
      groupOf.set(p.toLowerCase(), g.id);
      declaredOrder.set(p, declaredOrder.size);
    });
  });

  const seen = new Set<string>();
  const byProject = new Map<string, Map<string, StatusCode[]>>();
  const taskByCell = new Map<string, Map<string, string>>();

  for (const p of projects) {
    const inner = new Map<string, StatusCode[]>();
    const taskInner = new Map<string, string>();
    for (const plan of p.plans) {
      const name = (plan.planType || plan.name || '').trim();
      if (!name) continue;
      const code = toCode(plan.status);
      if (!code) continue;
      const canonical = canonicaliseName(name);
      if (!inner.has(canonical)) inner.set(canonical, []);
      inner.get(canonical)!.push(code);
      if (!taskInner.has(canonical)) taskInner.set(canonical, plan.id);
      seen.add(canonical);
    }
    byProject.set(p.folderId, inner);
    taskByCell.set(p.folderId, taskInner);
  }

  const plansByGroup = new Map<string, string[]>();
  PLAN_GROUPS.forEach((g) => plansByGroup.set(g.id, []));
  const extras: string[] = [];

  // Order the discovered plan types: those in the declared list keep that
  // order; the rest fall under 'plans' sorted alphabetically.
  Array.from(seen)
    .sort((a, b) => {
      const ra = declaredOrder.has(a) ? declaredOrder.get(a)! : Number.MAX_SAFE_INTEGER;
      const rb = declaredOrder.has(b) ? declaredOrder.get(b)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    })
    .forEach((name) => {
      const gid = groupOf.get(name.toLowerCase()) ?? 'plans';
      const bucket = plansByGroup.get(gid);
      if (bucket) bucket.push(name);
      else extras.push(name);
    });
  if (extras.length) plansByGroup.get('plans')!.push(...extras);

  const uniquePlans: string[] = [];
  PLAN_GROUPS.forEach((g) => uniquePlans.push(...(plansByGroup.get(g.id) ?? [])));

  return { groupOf, plansByGroup, byProject, uniquePlans, taskByCell };
}

// Canonical label: prefer the form declared in PLAN_GROUPS if a case-insensitive
// match exists, otherwise the trimmed source string.
const CANONICAL_BY_LOWER = (() => {
  const m = new Map<string, string>();
  PLAN_GROUPS.forEach((g) => g.plans.forEach((p) => m.set(p.toLowerCase(), p)));
  return m;
})();

function canonicaliseName(name: string): string {
  const lower = name.toLowerCase();
  return CANONICAL_BY_LOWER.get(lower) ?? name;
}

type DesignType = 'classic' | 'board' | 'heatmap';
const DESIGN_STORAGE_KEY = 'lib.matrix.designType';

interface Props {
  projects: Project[];
}

export function MatrixView({ projects }: Props) {
  const [design, setDesign] = useState<DesignType>('classic');

  // Restore persisted choice on mount. URL params (?design=) win when present.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DESIGN_STORAGE_KEY);
      if (saved === 'classic' || saved === 'board' || saved === 'heatmap') {
        setDesign(saved);
      }
    } catch {
      /* ignore — localStorage can throw in private mode or sandboxed iframes */
    }
  }, []);

  const pickDesign = (d: DesignType) => {
    setDesign(d);
    try {
      window.localStorage.setItem(DESIGN_STORAGE_KEY, d);
    } catch {
      /* ignore */
    }
  };

  const index = useMemo(() => buildPlanIndex(projects), [projects]);

  return (
    <div>
      <DesignPicker design={design} onPick={pickDesign} />

      {design === 'classic' && <ClassicMatrix projects={projects} index={index} />}
      {design === 'board' && <StatusBoard projects={projects} index={index} />}
      {design === 'heatmap' && <Heatmap projects={projects} index={index} />}

      <div
        style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
        }}
      >
        Click a cell or chip to jump to that filing in ClickUp
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Design picker bar
// ────────────────────────────────────────────────────────────────────────────

function DesignPicker({
  design,
  onPick,
}: {
  design: DesignType;
  onPick: (d: DesignType) => void;
}) {
  const opts: { d: DesignType; icon: string; label: string }[] = [
    { d: 'classic', icon: 'ti-table', label: 'A · Classic' },
    { d: 'board', icon: 'ti-columns-3', label: 'B · Status board' },
    { d: 'heatmap', icon: 'ti-color-swatch', label: 'C · Heatmap' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '11px 16px',
        background: 'var(--lib-softblack)',
        color: '#fff',
        borderRadius: 'var(--border-radius-md)',
        marginBottom: '1.25rem',
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 600,
          padding: '4px 9px',
          borderRadius: 4,
          background: 'var(--lib-orange)',
          color: '#000',
        }}
      >
        Design type
      </span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
        <strong style={{ color: '#fff', fontWeight: 500 }}>Three approaches</strong> to seeing the
        whole portfolio at once · pick one
      </span>
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginLeft: 'auto',
          padding: 3,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 'var(--border-radius-md)',
        }}
      >
        {opts.map((o) => {
          const active = design === o.d;
          return (
            <button
              key={o.d}
              type="button"
              onClick={() => onPick(o.d)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                borderRadius: 6,
                color: active ? '#000' : 'rgba(255,255,255,0.7)',
                background: active ? 'var(--lib-orange)' : 'transparent',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                userSelect: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className={`ti ${o.icon}`} style={{ fontSize: 13 }} />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────────────

const CELL_BG: Record<StatusCode, string> = {
  ap: 'var(--st-ap-bg)',
  fi: 'var(--st-fi-bg)',
  wo: 'var(--st-wo-bg)',
  tf: 'var(--st-tf-bg)',
  ts: 'var(--st-ts-bg)',
};
const CELL_FG: Record<StatusCode, string> = {
  ap: 'var(--st-ap-fg)',
  fi: 'var(--st-fi-fg)',
  wo: 'var(--st-wo-fg)',
  tf: 'var(--st-tf-fg)',
  ts: 'var(--st-ts-fg)',
};

function ProjectStats(project: Project) {
  const filings = project.plans.filter((p) => p.status != null);
  const stuck = filings.filter((p) => p.status === 'WO').length;
  return { filings: filings.length, permits: project.permits.length, stuck };
}

// ────────────────────────────────────────────────────────────────────────────
// A · Classic matrix — plans as rows, projects as horizontal columns
// ────────────────────────────────────────────────────────────────────────────

function ClassicMatrix({ projects, index }: { projects: Project[]; index: PlanIndex }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (id: string, force?: boolean) =>
    setCollapsed((prev) => ({ ...prev, [id]: force !== undefined ? force : !prev[id] }));
  const expandAll = () => {
    const next: Record<string, boolean> = {};
    PLAN_GROUPS.forEach((g) => (next[g.id] = false));
    setCollapsed(next);
  };
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    PLAN_GROUPS.forEach((g) => (next[g.id] = true));
    setCollapsed(next);
  };

  const planSummary = (plan: string) => {
    let total = 0;
    let approved = 0;
    for (const p of projects) {
      const arr = index.byProject.get(p.folderId)?.get(plan);
      if (arr && arr.length) {
        total++;
        if (arr.includes('ap') && !arr.some((s) => s === 'wo')) approved++;
      }
    }
    return { total, approved };
  };

  return (
    <div>
      <LegendStrip onExpandAll={expandAll} onCollapseAll={collapseAll} />
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'auto',
          maxHeight: '78vh',
        }}
      >
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 12,
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <ClassicThead projects={projects} index={index} />
          <tbody>
            {PLAN_GROUPS.map((g) => {
              const plans = index.plansByGroup.get(g.id) ?? [];
              if (!plans.length) return null;
              const isCollapsed = !!collapsed[g.id];
              return (
                <ClassicGroup
                  key={g.id}
                  group={g}
                  plans={plans}
                  projects={projects}
                  index={index}
                  planSummary={planSummary}
                  collapsed={isCollapsed}
                  onToggle={() => toggleGroup(g.id)}
                />
              );
            })}
          </tbody>
          <ClassicTfoot projects={projects} />
        </table>
      </div>
    </div>
  );
}

function LegendStrip({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const sw = (bg: string, label: string, withBar?: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 13,
          height: 13,
          borderRadius: 3,
          display: 'inline-block',
          background: bg,
          boxShadow: withBar ? 'inset 3px 0 0 var(--warn-strong)' : undefined,
        }}
      />
      {label}
    </span>
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 11,
        color: 'var(--color-text-tertiary)',
        marginBottom: 10,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginRight: 4 }}>
        Axis:
      </span>
      <span style={{ fontSize: 11 }}>Plans ↓ · Projects →</span>
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button type="button" style={softBtn} onClick={onExpandAll}>
          <i className="ti ti-arrows-maximize" /> Expand all
        </button>
        <button type="button" style={softBtn} onClick={onCollapseAll}>
          <i className="ti ti-arrows-minimize" /> Collapse all
        </button>
        {sw('var(--st-ap-bg)', 'Approved')}
        {sw('var(--st-fi-bg)', 'Filed')}
        {sw('var(--st-wo-bg)', 'Waiting', true)}
        {sw('var(--st-tf-bg)', 'To file')}
        {sw('var(--st-ts-bg)', 'To submit')}
      </div>
    </div>
  );
}

const softBtn: CSSProperties = {
  height: 26,
  padding: '0 10px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  fontSize: 11,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: 'var(--color-text-secondary)',
};

const TH_BASE: CSSProperties = {
  borderRight: '0.5px solid var(--color-border-tertiary)',
  borderBottom: '1px solid var(--color-border-secondary)',
  position: 'sticky',
  top: 0,
  zIndex: 3,
  background: 'var(--color-background-primary)',
  textAlign: 'center',
  padding: 0,
  fontWeight: 500,
  boxShadow: '0 0.5px 0 var(--color-border-secondary)',
};

const ROW_H_BASE: CSSProperties = {
  width: 220,
  minWidth: 220,
  maxWidth: 220,
  padding: '9px 12px 9px 18px',
  fontWeight: 500,
  fontSize: 12.5,
  color: 'var(--color-text-primary)',
  textAlign: 'left',
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: 'var(--color-background-primary)',
  boxShadow: '0.5px 0 0 var(--color-border-tertiary)',
  borderRight: '0.5px solid var(--color-border-tertiary)',
  borderBottom: '0.5px solid var(--color-border-tertiary)',
  verticalAlign: 'middle',
};

const ROW_SUM_BASE: CSSProperties = {
  width: 96,
  minWidth: 96,
  maxWidth: 96,
  padding: '9px 12px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-text-secondary)',
  fontSize: 12,
  position: 'sticky',
  right: 0,
  zIndex: 2,
  background: 'var(--color-background-primary)',
  boxShadow: '-0.5px 0 0 var(--color-border-tertiary)',
  borderBottom: '0.5px solid var(--color-border-tertiary)',
  verticalAlign: 'middle',
};

function ClassicThead({ projects, index }: { projects: Project[]; index: PlanIndex }) {
  return (
    <thead>
      <tr>
        <th style={{ ...TH_BASE, ...ROW_H_BASE, zIndex: 4, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Plan</div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              marginTop: 2,
              fontWeight: 500,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            }}
          >
            {index.uniquePlans.length} plans · {projects.length} projects
          </div>
        </th>
        {projects.map((p) => {
          const stats = ProjectStats(p);
          const coord = COORD_BY_ID[p.coord];
          return (
            <th
              key={p.folderId}
              style={{
                ...TH_BASE,
                width: 132,
                minWidth: 132,
                maxWidth: 132,
              }}
              title={p.name}
            >
              <a
                href={folderUrl(p.folderId)}
                target="_blank"
                rel="noopener"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '26px 1fr',
                  columnGap: 8,
                  alignItems: 'center',
                  padding: '8px 10px',
                  textAlign: 'left',
                  position: 'relative',
                  color: 'inherit',
                }}
              >
                <span
                  className={`avatar avatar-${p.coord}`}
                  style={{
                    gridRow: '1 / span 2',
                    width: 26,
                    height: 26,
                    fontSize: 10.5,
                    borderRadius: '50%',
                    fontWeight: 600,
                  }}
                  title={coord.name}
                >
                  {coord.initials}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  }}
                >
                  {stats.filings}f · {stats.permits}p
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: stats.stuck > 0 ? 'var(--warn-strong)' : 'var(--good-strong)',
                  }}
                />
              </a>
            </th>
          );
        })}
        <th style={{ ...TH_BASE, ...ROW_SUM_BASE, zIndex: 4 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Approved
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              marginTop: 2,
            }}
          >
            of projects
          </div>
        </th>
      </tr>
    </thead>
  );
}

function ClassicGroup({
  group,
  plans,
  projects,
  index,
  planSummary,
  collapsed,
  onToggle,
}: {
  group: { id: string; label: string };
  plans: string[];
  projects: Project[];
  index: PlanIndex;
  planSummary: (plan: string) => { total: number; approved: number };
  collapsed: boolean;
  onToggle: () => void;
}) {
  // Rollup per project for the group header row
  const rollupFor = (projId: string) => {
    const counts: Record<StatusCode, number> = { ap: 0, fi: 0, wo: 0, tf: 0, ts: 0 };
    let total = 0;
    const inner = index.byProject.get(projId);
    if (inner) {
      plans.forEach((pl) => {
        (inner.get(pl) ?? []).forEach((s) => {
          counts[s]++;
          total++;
        });
      });
    }
    return { counts, total };
  };

  let gTotal = 0;
  let gApproved = 0;
  plans.forEach((pl) => {
    const s = planSummary(pl);
    gTotal += s.total;
    gApproved += s.approved;
  });
  const groupPct = gTotal ? Math.round((gApproved / gTotal) * 100) : 0;

  const groupRowH: CSSProperties = {
    ...ROW_H_BASE,
    background: 'var(--color-background-secondary)',
    padding: 0,
  };
  const groupRowSum: CSSProperties = {
    ...ROW_SUM_BASE,
    background: 'var(--color-background-secondary)',
    padding: '10px 12px',
    fontSize: 12,
  };
  const groupCellTd: CSSProperties = {
    background: 'var(--color-background-secondary)',
    padding: 0,
    borderRight: '0.5px solid var(--color-border-tertiary)',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  };

  return (
    <>
      <tr>
        <td style={groupRowH}>
          <button
            type="button"
            onClick={onToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              fontWeight: 700,
              width: '100%',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-background-primary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 4,
                transition: 'transform .15s ease',
                transform: collapsed ? 'rotate(-90deg)' : undefined,
                flexShrink: 0,
              }}
            >
              <i
                className="ti ti-chevron-down"
                style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}
              />
            </span>
            <span>{group.label}</span>
            <span
              style={{
                color: 'var(--color-text-tertiary)',
                fontWeight: 500,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                letterSpacing: 0,
                textTransform: 'none',
                fontSize: 11,
              }}
            >
              · {plans.length}
            </span>
          </button>
        </td>
        {projects.map((p) => {
          const r = rollupFor(p.folderId);
          if (!r.total) {
            return (
              <td key={p.folderId} style={groupCellTd}>
                <div style={{ height: '100%', padding: '8px 6px' }} />
              </td>
            );
          }
          const pct = (k: StatusCode) => (r.counts[k] / r.total) * 100;
          return (
            <td key={p.folderId} style={groupCellTd}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    width: '78%',
                  }}
                >
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--color-background-tertiary)',
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    <i style={{ width: `${pct('ap')}%`, background: 'var(--good-strong)' }} />
                    <i style={{ width: `${pct('fi')}%`, background: 'var(--info-strong)' }} />
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--color-background-tertiary)',
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    <i style={{ width: `${pct('wo')}%`, background: 'var(--warn-strong)' }} />
                    <i
                      style={{
                        width: `${pct('tf')}%`,
                        background: 'var(--st-tf-fg)',
                        opacity: 0.5,
                      }}
                    />
                    <i
                      style={{
                        width: `${pct('ts')}%`,
                        background: 'var(--st-tf-fg)',
                        opacity: 0.25,
                      }}
                    />
                  </div>
                </div>
              </div>
            </td>
          );
        })}
        <td style={groupRowSum}>
          <b style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: 13 }}>
            {groupPct}%
          </b>
        </td>
      </tr>
      {!collapsed &&
        plans.map((plan) => {
          const s = planSummary(plan);
          return (
            <tr key={plan}>
              <td style={ROW_H_BASE}>
                {plan}
                {s.total < projects.length && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--color-text-tertiary)',
                      marginTop: 2,
                      fontWeight: 500,
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    }}
                  >
                    {s.total} of {projects.length}
                  </div>
                )}
              </td>
              {projects.map((p) => {
                const arr = index.byProject.get(p.folderId)?.get(plan);
                const taskId = index.taskByCell.get(p.folderId)?.get(plan);
                return (
                  <td
                    key={p.folderId}
                    style={{
                      borderRight: '0.5px solid var(--color-border-tertiary)',
                      borderBottom: '0.5px solid var(--color-border-tertiary)',
                      padding: 0,
                      background: 'var(--color-background-primary)',
                      verticalAlign: 'middle',
                    }}
                  >
                    <StatusCell arr={arr} taskId={taskId} />
                  </td>
                );
              })}
              <td style={ROW_SUM_BASE}>
                <b style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{s.approved}</b>
                /{s.total}
              </td>
            </tr>
          );
        })}
    </>
  );
}

function StatusCell({
  arr,
  taskId,
}: {
  arr: StatusCode[] | undefined;
  taskId: string | undefined;
}) {
  if (!arr || !arr.length) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 32,
          fontSize: 10.5,
          color: 'var(--color-text-tertiary)',
          fontWeight: 400,
          background:
            'repeating-linear-gradient(45deg, transparent 0 6px, rgba(0,0,0,0.025) 6px 7px)',
        }}
      >
        —
      </div>
    );
  }
  const w = worst(arr);
  const title = arr.map((s) => STATUS_NAME[s]).join(', ');
  const inner = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 32,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: CELL_FG[w],
        background: CELL_BG[w],
        position: 'relative',
        cursor: taskId ? 'pointer' : 'default',
        userSelect: 'none',
        boxShadow: w === 'wo' ? 'inset 3px 0 0 var(--warn-strong)' : undefined,
      }}
      title={title}
    >
      <span style={{ lineHeight: 1 }}>{STATUS_LABEL[w]}</span>
      {arr.length > 1 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 3,
            fontSize: 8.5,
            fontWeight: 600,
            color: 'rgba(0,0,0,0.5)',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          }}
        >
          ×{arr.length}
        </span>
      )}
    </div>
  );
  return taskId ? (
    <a
      href={taskUrl(taskId)}
      target="_blank"
      rel="noopener"
      style={{ display: 'block', color: 'inherit' }}
    >
      {inner}
    </a>
  ) : (
    inner
  );
}

function ClassicTfoot({ projects }: { projects: Project[] }) {
  return (
    <tfoot>
      <tr>
        <td
          style={{
            ...ROW_H_BASE,
            background: '#fffefb',
            padding: '10px 12px',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-tertiary)',
            fontWeight: 600,
            position: 'sticky',
            bottom: 0,
            left: 0,
            zIndex: 3,
            borderTop: '1px solid var(--color-border-secondary)',
            borderBottom: 'none',
            boxShadow: '0.5px 0 0 var(--color-border-tertiary)',
          }}
        >
          Approved · per project
        </td>
        {projects.map((p) => {
          const filings = p.plans.filter((pl) => pl.status != null);
          const total = filings.length;
          const approved = filings.filter((pl) => pl.status === 'AP').length;
          const flagged = filings.filter((pl) => pl.status === 'WO').length;
          const pct = total ? Math.round((approved / total) * 100) : 0;
          const warn = flagged > 0;
          return (
            <td
              key={p.folderId}
              style={{
                background: '#fffefb',
                padding: '10px 8px',
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                borderTop: '1px solid var(--color-border-secondary)',
                borderRight: '0.5px solid var(--color-border-tertiary)',
                position: 'sticky',
                bottom: 0,
                zIndex: 2,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  color: warn ? 'var(--warn-strong)' : 'var(--color-text-primary)',
                }}
              >
                <b style={{ fontSize: 13, fontWeight: 600 }}>{pct}%</b>
                <div
                  style={{
                    width: '70%',
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--color-background-tertiary)',
                    overflow: 'hidden',
                  }}
                >
                  <i
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${pct}%`,
                      background: warn ? 'var(--warn-strong)' : 'var(--good-strong)',
                    }}
                  />
                </div>
              </div>
            </td>
          );
        })}
        <td
          style={{
            ...ROW_SUM_BASE,
            background: '#fffefb',
            padding: '10px 12px',
            fontSize: 11,
            position: 'sticky',
            right: 0,
            bottom: 0,
            zIndex: 3,
            borderTop: '1px solid var(--color-border-secondary)',
            borderBottom: 'none',
          }}
        />
      </tr>
    </tfoot>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// B · Status board — Kanban-by-status
// ────────────────────────────────────────────────────────────────────────────

const BOARD_COLS: { id: StatusCode; label: string; tone: '' | 'urgent' | 'danger' }[] = [
  { id: 'wo', label: 'Waiting on agency', tone: 'urgent' },
  { id: 'fi', label: 'Filed · in flight', tone: '' },
  { id: 'tf', label: 'To file', tone: '' },
  { id: 'ts', label: 'To submit', tone: '' },
  { id: 'ap', label: 'Approved', tone: '' },
];

function StatusBoard({ projects, index }: { projects: Project[]; index: PlanIndex }) {
  // status → project.folderId → { plan-name list, plan-task list }
  const data = useMemo(() => {
    const map = new Map<
      StatusCode,
      Map<string, { name: string; taskId: string | null }[]>
    >();
    BOARD_COLS.forEach((c) => map.set(c.id, new Map()));
    for (const p of projects) {
      for (const plan of p.plans) {
        const code = toCode(plan.status);
        if (!code) continue;
        const name = canonicaliseName((plan.planType || plan.name || '').trim());
        if (!name) continue;
        const col = map.get(code)!;
        if (!col.has(p.folderId)) col.set(p.folderId, []);
        col.get(p.folderId)!.push({ name, taskId: plan.id });
      }
    }
    return map;
  }, [projects]);

  const totalFilings = projects.reduce(
    (a, p) => a + p.plans.filter((pl) => pl.status != null).length,
    0,
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Group by:</span>
        <span
          style={{
            padding: '5px 12px',
            fontSize: 11,
            borderRadius: 6,
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            fontWeight: 500,
            border: '0.5px solid var(--color-border-secondary)',
          }}
        >
          Status
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          Each filing becomes a chip under the column matching its current status, sub-grouped by
          project.
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BOARD_COLS.length}, minmax(220px, 1fr))`,
          gap: 12,
          alignItems: 'start',
        }}
      >
        {BOARD_COLS.map((c) => {
          const groups = data.get(c.id)!;
          const count = Array.from(groups.values()).reduce((a, b) => a + b.length, 0);
          const projCount = groups.size;
          const pctOfTotal = totalFilings ? Math.round((count / totalFilings) * 100) : 0;
          const isUrgent = c.tone === 'urgent';
          const isDanger = c.tone === 'danger';
          return (
            <div
              key={c.id}
              style={{
                background: 'var(--color-background-primary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 'var(--border-radius-lg)',
                overflow: 'hidden',
                minHeight: 200,
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: isUrgent
                    ? 'linear-gradient(180deg, rgba(250,199,117,0.18) 0%, transparent 100%)'
                    : isDanger
                      ? 'linear-gradient(180deg, rgba(252,235,235,0.6) 0%, transparent 100%)'
                      : undefined,
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
                    fontWeight: 700,
                    color: isUrgent
                      ? 'var(--warn-strong)'
                      : isDanger
                        ? 'var(--danger-strong)'
                        : 'var(--color-text-primary)',
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      flex: '0 0 12px',
                      background: CELL_BG[c.id],
                    }}
                  />
                  {c.label}
                  <span
                    style={{
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      letterSpacing: 0,
                      textTransform: 'none',
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                      marginLeft: 'auto',
                      fontWeight: 500,
                    }}
                  >
                    {count}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {projCount} {projCount === 1 ? 'project' : 'projects'} · {pctOfTotal}% of all
                  filings
                </div>
              </div>
              <div
                style={{
                  padding: '8px 8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }}
              >
                {groups.size === 0 ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                      textAlign: 'center',
                      padding: '24px 8px',
                    }}
                  >
                    —
                  </div>
                ) : (
                  Array.from(groups.entries()).map(([folderId, plans]) => {
                    const project = projects.find((x) => x.folderId === folderId);
                    if (!project) return null;
                    const coord = COORD_BY_ID[project.coord];
                    return (
                      <div
                        key={folderId}
                        style={{
                          background: 'var(--color-background-secondary)',
                          borderRadius: 'var(--border-radius-md)',
                          padding: '8px 10px',
                        }}
                      >
                        <a
                          href={folderUrl(folderId)}
                          target="_blank"
                          rel="noopener"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 6,
                            color: 'inherit',
                          }}
                        >
                          <span
                            className={`avatar avatar-${project.coord}`}
                            style={{
                              width: 20,
                              height: 20,
                              fontSize: 9,
                              borderRadius: '50%',
                              fontWeight: 600,
                            }}
                          >
                            {coord.initials}
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {project.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--color-text-tertiary)',
                              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                              marginLeft: 'auto',
                            }}
                          >
                            {plans.length}
                          </span>
                        </a>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {plans.map((pl, i) => {
                            const chip = (
                              <span
                                style={{
                                  background: isUrgent
                                    ? '#fff'
                                    : isDanger
                                      ? '#fff'
                                      : 'var(--color-background-primary)',
                                  border: isUrgent
                                    ? '0.5px solid var(--warn-strong)'
                                    : isDanger
                                      ? '0.5px solid var(--danger-strong)'
                                      : '0.5px solid var(--color-border-tertiary)',
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  padding: '3px 7px',
                                  color: isUrgent
                                    ? 'var(--warn-strong)'
                                    : isDanger
                                      ? 'var(--danger-strong)'
                                      : 'var(--color-text-primary)',
                                  whiteSpace: 'nowrap',
                                  fontWeight: isUrgent || isDanger ? 500 : undefined,
                                  display: 'inline-block',
                                }}
                              >
                                {pl.name}
                              </span>
                            );
                            return pl.taskId ? (
                              <a
                                key={`${pl.taskId}-${i}`}
                                href={taskUrl(pl.taskId)}
                                target="_blank"
                                rel="noopener"
                                style={{ color: 'inherit' }}
                              >
                                {chip}
                              </a>
                            ) : (
                              <span key={i}>{chip}</span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// C · Heatmap — cells colored by status
// ────────────────────────────────────────────────────────────────────────────

type HeatOrient = 'rows' | 'cols';
type HeatSize = 'xs' | 's' | 'm';

const HEAT_SIZES: Record<HeatSize, number> = { xs: 14, s: 22, m: 32 };

function Heatmap({ projects, index }: { projects: Project[]; index: PlanIndex }) {
  const [orient, setOrient] = useState<HeatOrient>('rows');
  const [size, setSize] = useState<HeatSize>('s');
  const tipRef = useRef<HTMLDivElement | null>(null);

  const cell = HEAT_SIZES[size];
  const totalFilings = projects.reduce(
    (a, p) => a + p.plans.filter((pl) => pl.status != null).length,
    0,
  );

  const showTip = (e: React.MouseEvent<HTMLElement>, content: string) => {
    const tip = tipRef.current;
    if (!tip) return;
    tip.innerHTML = content;
    tip.style.opacity = '1';
    tip.style.left = `${e.clientX + 12}px`;
    tip.style.top = `${e.clientY + 12}px`;
  };
  const moveTip = (e: React.MouseEvent<HTMLElement>) => {
    const tip = tipRef.current;
    if (!tip) return;
    tip.style.left = `${e.clientX + 12}px`;
    tip.style.top = `${e.clientY + 12}px`;
  };
  const hideTip = () => {
    const tip = tipRef.current;
    if (tip) tip.style.opacity = '0';
  };

  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '16px 18px 18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Heatmap orientation:
        </span>
        <Seg
          value={orient}
          options={[
            { v: 'rows' as const, label: 'Projects = rows' },
            { v: 'cols' as const, label: 'Projects = columns' },
          ]}
          onChange={setOrient}
        />
        <span
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 16 }}
        >
          Cell size:
        </span>
        <Seg
          value={size}
          options={[
            { v: 'xs' as const, label: 'XS' },
            { v: 's' as const, label: 'Sm' },
            { v: 'm' as const, label: 'Med' },
          ]}
          onChange={setSize}
        />
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
          }}
        >
          Hover a cell for details · {totalFilings} filings across {projects.length} projects
        </span>
      </div>

      {orient === 'rows' ? (
        <HeatmapRows
          projects={projects}
          index={index}
          cellSize={cell}
          onCellEnter={showTip}
          onCellMove={moveTip}
          onCellLeave={hideTip}
        />
      ) : (
        <HeatmapCols
          projects={projects}
          index={index}
          cellSize={cell}
          onCellEnter={showTip}
          onCellMove={moveTip}
          onCellLeave={hideTip}
        />
      )}

      <div
        ref={tipRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          background: 'var(--lib-softblack)',
          color: '#fff',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 11,
          lineHeight: 1.4,
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          opacity: 0,
          transition: 'opacity .12s',
          zIndex: 100,
          whiteSpace: 'nowrap',
        }}
      />
    </div>
  );
}

function Seg<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { v: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        padding: 2,
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
      }}
    >
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              borderRadius: 6,
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: active ? 'var(--color-background-primary)' : 'transparent',
              fontWeight: active ? 500 : 400,
              boxShadow: active ? '0 1px 1px rgba(0,0,0,0.04)' : undefined,
              cursor: 'pointer',
              userSelect: 'none',
              border: 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function tipContent(
  plan: string,
  proj: string,
  status: StatusCode | 'empty',
  count: number,
): string {
  if (status === 'empty') {
    return `<div><b style="color:var(--lib-orange);">${escapeHtml(plan)}</b></div><div style="display:flex;gap:12px;"><span>${escapeHtml(proj)}</span><span style="margin-left:auto;opacity:0.7;">not filed</span></div>`;
  }
  return `<div><b style="color:var(--lib-orange);">${escapeHtml(plan)}</b></div><div style="display:flex;gap:12px;"><span>${escapeHtml(proj)}</span><span style="margin-left:auto;opacity:0.7;">${STATUS_NAME[status]}${count > 1 ? ` ×${count}` : ''}</span></div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] as string));
}

function heatCellStyle(
  status: StatusCode | 'empty',
  cellSize: number,
): CSSProperties {
  const base: CSSProperties = {
    width: '100%',
    height: cellSize,
    cursor: 'pointer',
    transition: 'transform .12s, outline .12s',
    position: 'relative',
  };
  if (status === 'empty') {
    return { ...base, background: 'repeating-linear-gradient(45deg, #fff 0 4px, #f6f6f6 4px 5px)' };
  }
  return { ...base, background: CELL_BG[status] };
}

function HeatmapRows({
  projects,
  index,
  cellSize,
  onCellEnter,
  onCellMove,
  onCellLeave,
}: {
  projects: Project[];
  index: PlanIndex;
  cellSize: number;
  onCellEnter: (e: React.MouseEvent<HTMLElement>, content: string) => void;
  onCellMove: (e: React.MouseEvent<HTMLElement>) => void;
  onCellLeave: () => void;
}) {
  const cols: string[] = ['200px'];
  PLAN_GROUPS.forEach((g, i) => {
    if (i > 0) cols.push('6px');
    const plans = index.plansByGroup.get(g.id) ?? [];
    plans.forEach(() => cols.push(`${cellSize}px`));
  });
  const gridTemplate = cols.join(' ');

  // Section-label band
  const sectionLabels: React.ReactNode[] = [<div key="spacer" />];
  PLAN_GROUPS.forEach((g, i) => {
    const plans = index.plansByGroup.get(g.id) ?? [];
    if (i > 0) sectionLabels.push(<div key={`gap-${g.id}`} />);
    if (!plans.length) {
      sectionLabels.push(<div key={`lbl-${g.id}`} />);
      return;
    }
    let agg = 0;
    let total = 0;
    projects.forEach((p) => {
      const inner = index.byProject.get(p.folderId);
      plans.forEach((plan) => {
        (inner?.get(plan) ?? []).forEach((s) => {
          total++;
          if (s === 'ap') agg++;
        });
      });
    });
    const pct = total ? Math.round((agg / total) * 100) : 0;
    sectionLabels.push(
      <div
        key={`lbl-${g.id}`}
        style={{
          gridColumn: `span ${plans.length}`,
          padding: '0 4px 8px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--color-text-tertiary)',
          }}
        >
          {g.label}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--color-text-secondary)',
            marginTop: 2,
          }}
        >
          <b style={{ color: 'var(--color-text-primary)' }}>{pct}%</b> approved · {plans.length}{' '}
          plan{plans.length > 1 ? 's' : ''}
        </div>
      </div>,
    );
  });

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'end',
          marginBottom: 4,
          gap: '0 1px',
        }}
      >
        {sectionLabels}
      </div>
      {projects.map((p) => {
        const inner = index.byProject.get(p.folderId);
        const coord = COORD_BY_ID[p.coord];
        const stats = ProjectStats(p);
        return (
          <div
            key={p.folderId}
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              alignItems: 'center',
              gap: 1,
              padding: '1px 0',
            }}
          >
            <a
              href={folderUrl(p.folderId)}
              target="_blank"
              rel="noopener"
              style={{
                paddingRight: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'inherit',
              }}
            >
              <span
                className={`avatar avatar-${p.coord}`}
                style={{
                  width: 22,
                  height: 22,
                  fontSize: 9.5,
                  borderRadius: '50%',
                  fontWeight: 600,
                }}
              >
                {coord.initials}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.name}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color:
                    stats.stuck > 0
                      ? 'var(--warn-strong)'
                      : 'var(--color-text-tertiary)',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                }}
              >
                {stats.stuck > 0 ? `${stats.stuck}⚠` : ''}
              </span>
            </a>
            {PLAN_GROUPS.map((g, i) => {
              const plans = index.plansByGroup.get(g.id) ?? [];
              return (
                <Fragment key={g.id}>
                  {i > 0 && <div />}
                  {plans.map((plan) => {
                    const arr = inner?.get(plan) ?? [];
                    const status = arr.length ? worst(arr) : ('empty' as const);
                    const cnt = arr.length;
                    const taskId = index.taskByCell.get(p.folderId)?.get(plan);
                    const handlers = {
                      onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
                        onCellEnter(e, tipContent(plan, p.name, status, cnt)),
                      onMouseMove: onCellMove,
                      onMouseLeave: onCellLeave,
                    };
                    const cellEl = (
                      <div style={heatCellStyle(status, cellSize)} {...handlers} />
                    );
                    return taskId && status !== 'empty' ? (
                      <a
                        key={plan}
                        href={taskUrl(taskId)}
                        target="_blank"
                        rel="noopener"
                        style={{ display: 'block' }}
                      >
                        {cellEl}
                      </a>
                    ) : (
                      <div key={plan}>{cellEl}</div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function HeatmapCols({
  projects,
  index,
  cellSize,
  onCellEnter,
  onCellMove,
  onCellLeave,
}: {
  projects: Project[];
  index: PlanIndex;
  cellSize: number;
  onCellEnter: (e: React.MouseEvent<HTMLElement>, content: string) => void;
  onCellMove: (e: React.MouseEvent<HTMLElement>) => void;
  onCellLeave: () => void;
}) {
  const projColTrack = `${Math.max(cellSize, 22)}px`;
  const gridTemplate = `240px ${projects.map(() => projColTrack).join(' ')}`;

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'end',
          marginBottom: 6,
          gap: 1,
        }}
      >
        <div />
        {projects.map((p) => {
          const coord = COORD_BY_ID[p.coord];
          return (
            <div key={p.folderId} style={{ textAlign: 'center', paddingBottom: 4 }}>
              <span
                className={`avatar avatar-${p.coord}`}
                style={{
                  width: 18,
                  height: 18,
                  fontSize: 8.5,
                  borderRadius: '50%',
                  fontWeight: 600,
                }}
              >
                {coord.initials}
              </span>
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--color-text-secondary)',
                  marginTop: 3,
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  height: 70,
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </div>
            </div>
          );
        })}
      </div>
      {PLAN_GROUPS.map((g) => {
        const plans = index.plansByGroup.get(g.id) ?? [];
        if (!plans.length) return null;
        return (
          <div
            key={g.id}
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: 1,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '12px 0 6px',
                borderTop: '0.5px solid var(--color-border-tertiary)',
                marginTop: 6,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {g.label}
              </div>
            </div>
            {plans.map((plan) => (
              <Fragment key={plan}>
                <div
                  style={{
                    fontSize: 11,
                    paddingRight: 10,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {plan}
                </div>
                {projects.map((p) => {
                  const arr = index.byProject.get(p.folderId)?.get(plan) ?? [];
                  const status = arr.length ? worst(arr) : ('empty' as const);
                  const taskId = index.taskByCell.get(p.folderId)?.get(plan);
                  const handlers = {
                    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
                      onCellEnter(e, tipContent(plan, p.name, status, arr.length)),
                    onMouseMove: onCellMove,
                    onMouseLeave: onCellLeave,
                  };
                  const cellEl = (
                    <div style={heatCellStyle(status, cellSize)} {...handlers} />
                  );
                  return taskId && status !== 'empty' ? (
                    <a
                      key={p.folderId}
                      href={taskUrl(taskId)}
                      target="_blank"
                      rel="noopener"
                      style={{ display: 'block' }}
                    >
                      {cellEl}
                    </a>
                  ) : (
                    <div key={p.folderId}>{cellEl}</div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}

