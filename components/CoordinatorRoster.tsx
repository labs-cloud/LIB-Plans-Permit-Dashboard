'use client';

import type { CoordinatorId } from '@/lib/constants';
import { COORDINATORS, UNASSIGNED } from '@/lib/constants';
import type { Project } from '@/lib/types';
import { CoordinatorAvatar } from './CoordinatorAvatar';

interface Props {
  projects: Project[];
  activeCoord: CoordinatorId | 'all';
  onCoordToggle: (c: CoordinatorId) => void;
}

function countProjects(projects: Project[], coord: CoordinatorId): number {
  return projects.filter((p) => p.coord === coord).length;
}

function countPlansInFlight(projects: Project[], coord: CoordinatorId): number {
  let n = 0;
  for (const p of projects) {
    if (p.coord !== coord) continue;
    for (const plan of p.plans) {
      if (plan.status === 'FI' || plan.status === 'WO' || plan.status === 'TF') n += 1;
    }
  }
  return n;
}

function countWaitingOn(projects: Project[], coord: CoordinatorId): number {
  let n = 0;
  for (const p of projects) {
    if (p.coord !== coord) continue;
    for (const plan of p.plans) {
      if (plan.status === 'WO') n += 1;
    }
  }
  return n;
}

export function CoordinatorRoster({ projects, activeCoord, onCoordToggle }: Props) {
  const cards: Array<{
    id: CoordinatorId;
    name: string;
    bg: string;
    bgActive: string;
    textDark: string;
    sub: string;
  }> = [
    {
      id: 'faigy',
      name: COORDINATORS[0].name,
      bg: COORDINATORS[0].bg,
      bgActive: COORDINATORS[0].bgActive,
      textDark: COORDINATORS[0].textDark,
      sub: COORDINATORS[0].color,
    },
    {
      id: 'malky',
      name: COORDINATORS[1].name,
      bg: COORDINATORS[1].bg,
      bgActive: COORDINATORS[1].bgActive,
      textDark: COORDINATORS[1].textDark,
      sub: COORDINATORS[1].color,
    },
    {
      id: 'unassigned',
      name: UNASSIGNED.name,
      bg: 'var(--color-background-secondary)',
      bgActive: '#D3D1C7',
      textDark: 'var(--color-text-primary)',
      sub: 'var(--color-text-secondary)',
    },
  ];

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="section-title">
        <i className="ti ti-users" style={{ fontSize: 16 }} /> Project Coordinators
      </div>
      <div className="coordinator-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {cards.map((card) => {
          const count = countProjects(projects, card.id);
          const isActive = activeCoord === card.id;
          const inFlight = card.id === 'unassigned' ? null : countPlansInFlight(projects, card.id);
          const waiting = card.id === 'unassigned' ? null : countWaitingOn(projects, card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onCoordToggle(card.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: isActive ? card.bgActive : card.bg,
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <CoordinatorAvatar coord={card.id} size={36} fontSize={13} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: card.textDark }}>
                  {card.name}
                </div>
                <div style={{ fontSize: 11, color: card.sub }}>
                  {card.id === 'unassigned'
                    ? `${count} project${count === 1 ? '' : 's'} · needs assignment`
                    : `${count} project${count === 1 ? '' : 's'} · ${inFlight} in flight · ${waiting} waiting on`}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
