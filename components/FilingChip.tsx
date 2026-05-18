'use client';

import { memo } from 'react';
import type { Plan, StatusKey } from '@/lib/types';
import { taskUrl } from '@/lib/urls';
import type { ChipStyle } from './ViewSettings';

interface StyleSpec {
  bg: string;
  fg: string;
  border: string;
  statusLabel: string;
  // Dot/Stripe accent color (the dot or left-edge bar).
  accent: string;
  // For "Dot" + "Stripe": the tinted background to apply to urgent (WO) chips.
  urgentBg: string;
}

const SPECS: Record<StatusKey, StyleSpec> = {
  AP: {
    bg: 'var(--st-ap-bg)',
    fg: 'var(--st-ap-fg)',
    border: 'rgba(127,174,82,0.6)',
    statusLabel: 'Approved',
    accent: 'var(--good-strong)',
    urgentBg: '#fff',
  },
  FI: {
    bg: 'var(--st-fi-bg)',
    fg: 'var(--st-fi-fg)',
    border: 'rgba(95,148,204,0.6)',
    statusLabel: 'submitted',
    accent: 'var(--info-strong)',
    urgentBg: '#fff',
  },
  WO: {
    bg: 'var(--st-wo-bg)',
    fg: 'var(--st-wo-fg)',
    border: 'var(--warn-strong)',
    statusLabel: 'Waiting on',
    accent: 'var(--warn-strong)',
    urgentBg: '#fff7e6',
  },
  TF: {
    bg: 'var(--st-tf-bg)',
    fg: 'var(--st-tf-fg)',
    border: 'rgba(168,165,149,0.6)',
    statusLabel: 'To file',
    accent: 'var(--st-tf-fg)',
    urgentBg: '#fff',
  },
  TS: {
    bg: 'var(--st-ts-bg)',
    fg: 'var(--st-ts-fg)',
    border: 'rgba(199,195,181,0.6)',
    statusLabel: 'To submit',
    accent: 'var(--color-text-tertiary)',
    urgentBg: '#fff',
  },
};

const UNMAPPED: StyleSpec = {
  bg: 'var(--color-background-secondary)',
  fg: 'var(--color-text-secondary)',
  border: 'var(--color-border-tertiary)',
  statusLabel: '—',
  accent: 'var(--color-text-tertiary)',
  urgentBg: '#fff',
};

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

export function expandPlanName(raw: string): string {
  if (FULL_NAME[raw]) return FULL_NAME[raw];
  const m = /^[A-Z]{2,4}\s+-\s+(.*)$/.exec(raw);
  return m ? m[1] : raw;
}

export function planLabel(plan: Plan): string {
  return expandPlanName(plan.planType ?? plan.matrixColumn ?? plan.name);
}

interface ChipProps {
  plan: Plan;
  chipStyle: ChipStyle;
}

export const FilingChip = memo(function FilingChip({ plan, chipStyle }: ChipProps) {
  const spec = plan.status ? SPECS[plan.status] : UNMAPPED;
  const statusLabel = spec.statusLabel === '—' ? plan.rawStatus || '—' : spec.statusLabel;
  const name = planLabel(plan);
  const isUrgent = plan.status === 'WO';
  const href = taskUrl(plan.id);
  const title = plan.planType ?? plan.name;

  if (chipStyle === 'solid') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        title={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 14px',
          borderRadius: 999,
          background: spec.bg,
          color: spec.fg,
          fontSize: 12.5,
          fontWeight: 600,
          letterSpacing: '-0.005em',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
        <span
          style={{
            fontSize: 9.5,
            fontWeight: isUrgent ? 700 : 500,
            textTransform: 'uppercase',
            letterSpacing: '0.11em',
            color: spec.fg,
            opacity: isUrgent ? 0.85 : 0.6,
            lineHeight: 1,
          }}
        >
          {statusLabel}
        </span>
      </a>
    );
  }

  if (chipStyle === 'dot') {
    const bg = isUrgent ? spec.urgentBg : '#fff';
    const borderColor = isUrgent ? spec.border : 'var(--color-border-tertiary)';
    const isHollow = plan.status === 'TS';
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        title={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 11px',
          borderRadius: 999,
          border: `0.5px solid ${borderColor}`,
          background: bg,
          color: 'var(--color-text-primary)',
          fontSize: 12.5,
          fontWeight: 600,
          letterSpacing: '-0.005em',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: isHollow ? 7 : 8,
            height: isHollow ? 7 : 8,
            borderRadius: '50%',
            background: isHollow ? 'transparent' : spec.accent,
            border: isHollow ? `1px solid ${spec.accent}` : 'none',
            opacity: plan.status === 'TF' || plan.status === 'TS' ? 0.6 : 1,
            flex: '0 0 auto',
          }}
        />
        {name}
        <span
          style={{
            fontSize: 11,
            fontWeight: isUrgent ? 600 : 400,
            color: isUrgent
              ? spec.accent
              : plan.status === 'AP' || plan.status === 'FI'
              ? spec.accent
              : 'var(--color-text-tertiary)',
            lineHeight: 1,
          }}
        >
          {statusLabel}
        </span>
      </a>
    );
  }

  // stripe
  const bg = isUrgent ? spec.urgentBg : '#fff';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      title={title}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px 6px 14px',
        borderRadius: 6,
        border: '0.5px solid var(--color-border-tertiary)',
        background: bg,
        color: 'var(--color-text-primary)',
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isUrgent ? 5 : 4,
          background: spec.accent,
          opacity: plan.status === 'TS' ? 0.35 : plan.status === 'TF' ? 0.6 : 1,
        }}
      />
      {name}
      <span
        style={{
          fontSize: 11,
          fontWeight: isUrgent ? 600 : 400,
          color: isUrgent ? spec.accent : 'var(--color-text-tertiary)',
          lineHeight: 1,
        }}
      >
        {statusLabel}
      </span>
    </a>
  );
});

interface PermitsChipProps {
  label: string;
  count: number;
  href: string;
  chipStyle: ChipStyle;
}

export const PermitsChip = memo(function PermitsChip({
  label,
  count,
  href,
  chipStyle,
}: PermitsChipProps) {
  if (chipStyle === 'stripe') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 6,
          background: 'var(--good-bg)',
          color: 'var(--good-fg)',
          fontSize: 12.5,
          fontWeight: 600,
          letterSpacing: '-0.005em',
          whiteSpace: 'nowrap',
        }}
      >
        Permits
        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.75 }}>
          {label.replace('● ', '')} · {count} active
        </span>
      </a>
    );
  }
  if (chipStyle === 'dot') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
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
        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.75 }}>
          {count} active
        </span>
      </a>
    );
  }
  return (
    <a
      href={href}
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
          opacity: 0.7,
          lineHeight: 1,
        }}
      >
        {label.replace('● ', '')}
      </span>
    </a>
  );
});
