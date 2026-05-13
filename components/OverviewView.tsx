'use client';

import type { CoordinatorId, PhaseId } from '@/lib/constants';
import type { Project, StickingItem } from '@/lib/types';
import { PortfolioMatrix } from './PortfolioMatrix';
import { StickingList } from './StickingList';
import { PhaseSummary } from './PhaseSummary';

interface Props {
  projects: Project[];
  matrixColumns: string[];
  totalCount: number;
  sticking: StickingItem[];
  activeCoord: CoordinatorId | 'all';
  activePhase: PhaseId | 'all';
  onPhaseToggle: (p: PhaseId) => void;
  filterTag: string | null;
}

export function OverviewView({
  projects,
  matrixColumns,
  totalCount,
  sticking,
  activePhase,
  onPhaseToggle,
  filterTag,
}: Props) {
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 14,
          marginBottom: '1.25rem',
        }}
      >
        <StickingList items={sticking} />
        <PhaseSummary
          projects={projects}
          activePhase={activePhase}
          onPhaseToggle={onPhaseToggle}
        />
      </div>
      <PortfolioMatrix
        projects={projects}
        matrixColumns={matrixColumns}
        totalCount={totalCount}
        filterTag={filterTag}
      />
    </div>
  );
}
