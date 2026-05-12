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
    <div className="card">
      <div className="section-title">
        <i className="ti ti-layers-intersect" style={{ fontSize: 16, color: '#534AB7' }} /> Active by phase
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
                padding: '10px 12px',
                background: phase.bg,
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'left',
                outline: isActive ? `2px solid ${phase.text}` : 'none',
                outlineOffset: isActive ? '-2px' : 0,
                width: '100%',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <strong style={{ fontSize: 12, color: phase.text }}>{phase.label}</strong>
                <span style={{ fontSize: 16, fontWeight: 500, color: phase.text }}>
                  {counts[phase.id]}
                </span>
              </div>
              <div style={{ fontSize: 11, color: phase.sub, marginTop: 4 }}>{phase.subline}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
