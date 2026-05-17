'use client';

import type { PhaseId } from '@/lib/constants';
import { PHASES } from '@/lib/constants';
import type { Project } from '@/lib/types';

interface Props {
  projects: Project[];
  activePhase: PhaseId | 'all';
  onPhaseToggle: (p: PhaseId) => void;
}

export function PhaseSummary({ projects, activePhase, onPhaseToggle }: Props) {
  const counts: Record<PhaseId, number> = { pre: 0, con: 0, post: 0 };
  for (const p of projects) {
    if (p.phase) counts[p.phase] += 1;
  }

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
        <i
          className="ti ti-layers-intersect"
          style={{ fontSize: 16, color: 'var(--c-faigy)' }}
        />{' '}
        Active by phase
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            fontWeight: 400,
          }}
        >
          click to filter
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PHASES.map((phase) => {
          const isActive = activePhase === phase.id;
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => onPhaseToggle(phase.id)}
              style={{
                padding: '16px 18px',
                background: phase.bg,
                color: phase.text,
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                outline: isActive ? `2px solid ${phase.text}` : 'none',
                outlineOffset: isActive ? '-2px' : 0,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{phase.label}</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                  {phase.subline}
                </div>
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {counts[phase.id]}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
