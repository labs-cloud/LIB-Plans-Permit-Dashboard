'use client';

import type { CoordinatorId } from '@/lib/constants';
import { COORDINATORS, UNASSIGNED } from '@/lib/constants';
import type { Project, StatusKey } from '@/lib/types';
import { CoordinatorAvatar } from './CoordinatorAvatar';

interface Props {
  projects: Project[];
  activeCoord: CoordinatorId | 'all';
  onCoordToggle: (c: CoordinatorId) => void;
}

interface RosterRow {
  id: CoordinatorId;
  name: string;
  projectCount: number;
  segments: Record<StatusKey, number>;
  total: number;
}

function buildRow(projects: Project[], id: CoordinatorId): RosterRow {
  const segments: Record<StatusKey, number> = { AP: 0, FI: 0, WO: 0, TF: 0, TS: 0 };
  let projectCount = 0;
  for (const p of projects) {
    if (p.coord !== id) continue;
    projectCount += 1;
    for (const plan of p.plans) {
      if (plan.status) segments[plan.status] += 1;
    }
  }
  const total = segments.AP + segments.FI + segments.WO + segments.TF + segments.TS;
  return { id, name: '', projectCount, segments, total };
}

const SEG_ORDER: { key: StatusKey; bar: string; bg: string; tag: string; fg?: string }[] = [
  { key: 'AP', bar: 'var(--st-ap-bar)', bg: 'var(--st-ap-bg)', tag: 'AP' },
  { key: 'FI', bar: 'var(--st-fi-bar)', bg: 'var(--st-fi-bg)', tag: 'FI' },
  { key: 'WO', bar: 'var(--st-wo-bar)', bg: 'var(--st-wo-bg)', tag: 'WO' },
  { key: 'TF', bar: 'var(--st-tf-bar)', bg: 'var(--st-tf-bg)', tag: 'TF' },
  { key: 'TS', bar: 'var(--st-ts-bar)', bg: 'var(--st-ts-bg)', tag: 'TS', fg: 'var(--color-text-primary)' },
];

const LEGEND: { color: string; label: string }[] = [
  { color: 'var(--st-ap-bar)', label: 'Approved' },
  { color: 'var(--st-fi-bar)', label: 'Filed' },
  { color: 'var(--st-wo-bar)', label: 'Waiting on' },
  { color: 'var(--st-tf-bar)', label: 'To file' },
  { color: 'var(--st-ts-bar)', label: 'To submit' },
];

export function CoordinatorWorkload({ projects, activeCoord, onCoordToggle }: Props) {
  const rows: RosterRow[] = [
    { ...buildRow(projects, 'faigy'), name: COORDINATORS[0].name },
    { ...buildRow(projects, 'malky'), name: COORDINATORS[1].name },
    { ...buildRow(projects, 'unassigned'), name: UNASSIGNED.name },
  ];

  return (
    <div
      className="card"
      style={{ marginBottom: '1.25rem', padding: '20px 22px' }}
    >
      <div
        className="section-title"
        style={{
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <i className="ti ti-users" style={{ fontSize: 16 }} /> Coordinator workload
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            fontWeight: 400,
          }}
        >
          filings only · click a row to filter
        </span>
      </div>

      {rows.map((row, i) => {
        const isActive = activeCoord === row.id;
        const subline =
          row.id === 'unassigned'
            ? `${row.projectCount} project${row.projectCount === 1 ? '' : 's'} · needs assignment`
            : `${row.projectCount} project${row.projectCount === 1 ? '' : 's'}`;
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onCoordToggle(row.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr 60px',
              gap: 16,
              alignItems: 'center',
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '0.5px solid var(--color-border-tertiary)',
              width: '100%',
              textAlign: 'left',
              background: isActive ? 'var(--color-background-secondary)' : 'transparent',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <CoordinatorAvatar coord={row.id} size={32} fontSize={12} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{row.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {subline}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                height: 28,
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--color-background-tertiary)',
                visibility: row.total === 0 ? 'hidden' : 'visible',
              }}
            >
              {SEG_ORDER.map((seg) => {
                const count = row.segments[seg.key];
                if (count === 0) return null;
                return (
                  <div
                    key={seg.key}
                    title={`${count} ${seg.tag}`}
                    style={{
                      flex: count,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      padding: '0 8px',
                      background: seg.bar,
                      color: seg.fg ?? '#fff',
                      fontSize: 11,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {count} {seg.tag}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: row.total === 0 ? 'var(--color-text-tertiary)' : 'inherit',
              }}
            >
              {row.total === 0 ? '—' : row.total}
            </div>
          </button>
        );
      })}

      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          marginTop: 12,
        }}
      >
        {LEGEND.map((l) => (
          <span
            key={l.label}
            style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}
          >
            <i
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: l.color,
                display: 'inline-block',
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
