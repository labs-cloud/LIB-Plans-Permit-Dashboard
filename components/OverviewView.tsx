'use client';

import Link from 'next/link';

import type { CoordinatorId, PhaseId } from '@/lib/constants';
import type {
  KpiStripData,
  PermitsPanelData,
  Project,
  StickingItem,
} from '@/lib/types';
import { CoordinatorWorkload } from './CoordinatorWorkload';
import { HeroMosaic } from './HeroMosaic';
import { PhaseSummary } from './PhaseSummary';
import { PortfolioGlance } from './PortfolioGlance';

interface Props {
  projects: Project[];
  totalCount: number;
  sticking: StickingItem[];
  kpis: KpiStripData;
  permits: PermitsPanelData;
  activeCoord: CoordinatorId | 'all';
  activePhase: PhaseId | 'all';
  onCoordToggle: (c: CoordinatorId) => void;
  onPhaseToggle: (p: PhaseId) => void;
  onSwitchToDetailed: () => void;
}

export function OverviewView({
  projects,
  totalCount,
  sticking,
  kpis,
  permits,
  activeCoord,
  activePhase,
  onCoordToggle,
  onPhaseToggle,
  onSwitchToDetailed,
}: Props) {
  const permitsCount = permits.active + permits.expiring30d + permits.expired;
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 12,
        }}
      >
        <Link
          href="/permits"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--lib-softblack)',
            color: '#fff',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 13,
            fontWeight: 500,
          }}
          title="Open the permits dashboard"
        >
          <i className="ti ti-license" style={{ fontSize: 15 }} />
          Permits dashboard
          {permitsCount > 0 && (
            <span
              style={{
                background: 'var(--lib-orange)',
                color: '#000',
                fontSize: 11,
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: 999,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {permitsCount}
            </span>
          )}
          <i className="ti ti-arrow-right" style={{ fontSize: 14, opacity: 0.7 }} />
        </Link>
      </div>

      <HeroMosaic kpis={kpis} sticking={sticking} permits={permits} />

      <CoordinatorWorkload
        projects={projects}
        activeCoord={activeCoord}
        onCoordToggle={onCoordToggle}
      />

      <div
        className="overview-two-up"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        <PhaseSummary
          projects={projects}
          activePhase={activePhase}
          onPhaseToggle={onPhaseToggle}
        />
        <PortfolioGlance
          projects={projects}
          totalCount={totalCount}
          onSwitchToDetailed={onSwitchToDetailed}
        />
      </div>
    </div>
  );
}
