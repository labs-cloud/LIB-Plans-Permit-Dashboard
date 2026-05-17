'use client';

import { useState } from 'react';
import type { Project, StatusKey } from '@/lib/types';
import { COORD_BY_ID } from '@/lib/constants';
import { folderUrl } from '@/lib/urls';
import { CoordinatorAvatar } from './CoordinatorAvatar';
import { FilingChip } from './FilingChip';
import type { ChipStyle } from './ViewSettings';

interface Props {
  project: Project;
  chipStyle: ChipStyle;
}

const SEG_ORDER: { key: StatusKey; bg: string; fg: string; label: string }[] = [
  { key: 'AP', bg: 'var(--st-ap-bg)', fg: 'var(--st-ap-fg)', label: 'AP' },
  { key: 'FI', bg: 'var(--st-fi-bg)', fg: 'var(--st-fi-fg)', label: 'FI' },
  { key: 'TF', bg: 'var(--st-tf-bg)', fg: 'var(--st-tf-fg)', label: 'TF' },
  { key: 'TS', bg: 'var(--st-ts-bg)', fg: 'var(--st-ts-fg)', label: 'TS' },
  { key: 'WO', bg: 'var(--st-wo-bg)', fg: 'var(--st-wo-fg)', label: 'WO' },
];

const DAY = 24 * 60 * 60 * 1000;

function counts(project: Project): Record<StatusKey, number> {
  const c: Record<StatusKey, number> = { AP: 0, FI: 0, WO: 0, TF: 0, TS: 0 };
  for (const plan of project.plans) {
    if (plan.status) c[plan.status] += 1;
  }
  return c;
}

function maxStuckDays(project: Project): number {
  const now = Date.now();
  let max = 0;
  for (const plan of project.plans) {
    if (plan.status !== 'WO') continue;
    const d = Math.max(0, Math.floor((now - plan.dateUpdated) / DAY));
    if (d > max) max = d;
  }
  return max;
}

export function CompactRow({ project, chipStyle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const coordMeta = COORD_BY_ID[project.coord];
  const c = counts(project);
  const total = c.AP + c.FI + c.WO + c.TF + c.TS;
  const woDays = maxStuckDays(project);
  const flagged = c.WO > 0;
  const queued = c.TF + c.TS;
  const urgentPlans = project.plans.filter((p) => p.status === 'WO');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1.5fr) 1fr auto',
        gap: 18,
        alignItems: 'center',
        padding: '14px 18px',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderLeft: flagged
          ? '3px solid var(--warn-strong)'
          : '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <CoordinatorAvatar coord={project.coord} size={28} fontSize={10} />
        <div style={{ minWidth: 0 }}>
          <a
            href={folderUrl(project.folderId)}
            target="_blank"
            rel="noopener"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              display: 'inline-block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {project.name}
          </a>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              marginTop: 1,
            }}
          >
            <span style={{ color: coordMeta.color }}>{coordMeta.name}</span> · {total} filings ·{' '}
            {project.permitsSummary.total} permits ·{' '}
            {flagged ? (
              <span style={{ color: 'var(--warn-strong)', fontWeight: 500 }}>
                ⚠ {c.WO} stuck{woDays > 0 ? ` · ${woDays}d` : ''}
              </span>
            ) : (
              <span style={{ color: 'var(--good-fg)' }}>on track</span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          height: 22,
          borderRadius: 5,
          overflow: 'hidden',
          background: 'var(--color-background-tertiary)',
          minWidth: 220,
        }}
        title={`AP ${c.AP} · FI ${c.FI} · TF ${c.TF} · TS ${c.TS} · WO ${c.WO}`}
      >
        {SEG_ORDER.map((seg) => {
          const n = c[seg.key];
          if (n === 0) return null;
          return (
            <span
              key={seg.key}
              style={{
                flex: n,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: seg.bg,
                color: seg.fg,
                fontSize: 10,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n}
            </span>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
          alignItems: 'center',
        }}
      >
        <span>
          <b style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{c.AP}</b> approved
        </span>
        <span>
          <b style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{c.FI}</b> in flight
        </span>
        <span>
          <b style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{queued}</b> queued
        </span>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
          }}
        >
          <i className={`ti ti-chevron-${expanded ? 'up' : 'down'}`} />
          {expanded ? 'collapse' : 'expand'}
        </button>
      </div>

      {(urgentPlans.length > 0 || expanded) && (
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 4,
            paddingTop: 12,
            borderTop: '0.5px dashed var(--color-border-tertiary)',
          }}
        >
          {(expanded ? project.plans : urgentPlans).map((plan) => (
            <FilingChip key={plan.id} plan={plan} chipStyle={chipStyle} />
          ))}
        </div>
      )}
    </div>
  );
}
