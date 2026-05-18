'use client';

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
  return (
    <div>
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
