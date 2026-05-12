'use client';

import type { CoordinatorId, PhaseId } from '@/lib/constants';

export type ViewMode = 'overview' | 'detailed';

interface Props {
  search: string;
  coord: CoordinatorId | 'all';
  phase: PhaseId | 'all';
  view: ViewMode;
  onSearchChange: (s: string) => void;
  onCoordChange: (c: CoordinatorId | 'all') => void;
  onPhaseChange: (p: PhaseId | 'all') => void;
  onViewChange: (v: ViewMode) => void;
}

export function FilterBar({
  search,
  coord,
  phase,
  view,
  onSearchChange,
  onCoordChange,
  onPhaseChange,
  onViewChange,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <input
        type="search"
        placeholder="Search projects…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ flex: 1, minWidth: 160, maxWidth: 220, fontSize: 13 }}
      />
      <select
        value={coord}
        onChange={(e) => onCoordChange(e.target.value as CoordinatorId | 'all')}
        style={{
          fontSize: 13,
          background: coord !== 'all' ? '#EEEDFE' : undefined,
          color: coord !== 'all' ? '#26215C' : undefined,
          fontWeight: coord !== 'all' ? 500 : undefined,
          borderColor: coord !== 'all' ? '#AFA9EC' : undefined,
        }}
      >
        <option value="all">👤 All coordinators</option>
        <option value="faigy">Faigy Follman</option>
        <option value="malky">Malky Kahan</option>
        <option value="unassigned">Unassigned</option>
      </select>
      <select
        value={phase}
        onChange={(e) => onPhaseChange(e.target.value as PhaseId | 'all')}
        style={{ fontSize: 13 }}
      >
        <option value="all">All phases</option>
        <option value="pre">Pre-construction</option>
        <option value="con">Construction</option>
        <option value="post">Post-construction</option>
      </select>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          background: 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius-md)',
          marginLeft: 'auto',
        }}
      >
        <button
          type="button"
          className={`tab ${view === 'overview' ? 'active' : ''}`}
          onClick={() => onViewChange('overview')}
        >
          <i className="ti ti-grid-dots" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />
          Overview
        </button>
        <button
          type="button"
          className={`tab ${view === 'detailed' ? 'active' : ''}`}
          onClick={() => onViewChange('detailed')}
        >
          <i className="ti ti-list-details" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />
          Detailed
        </button>
      </div>
    </div>
  );
}
