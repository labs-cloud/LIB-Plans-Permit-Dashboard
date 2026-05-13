'use client';

import type { CoordinatorId, PhaseId } from '@/lib/constants';

export type ViewMode = 'overview' | 'detailed';

interface Props {
  search: string;
  coord: CoordinatorId | 'all';
  phase: PhaseId | 'all';
  setType: string | 'all';
  setTypeOptions: string[];
  view: ViewMode;
  onSearchChange: (s: string) => void;
  onCoordChange: (c: CoordinatorId | 'all') => void;
  onPhaseChange: (p: PhaseId | 'all') => void;
  onSetTypeChange: (s: string | 'all') => void;
  onViewChange: (v: ViewMode) => void;
}

export function FilterBar({
  search,
  coord,
  phase,
  setType,
  setTypeOptions,
  view,
  onSearchChange,
  onCoordChange,
  onPhaseChange,
  onSetTypeChange,
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
      <select
        value={setType}
        onChange={(e) => onSetTypeChange(e.target.value)}
        title="Filter plans by Set Type"
        style={{
          fontSize: 13,
          background: setType !== 'all' ? '#FEF1E5' : undefined,
          color: setType !== 'all' ? '#7A3A11' : undefined,
          fontWeight: setType !== 'all' ? 500 : undefined,
          borderColor: setType !== 'all' ? '#F4A973' : undefined,
        }}
      >
        <option value="all">All set types</option>
        {setTypeOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
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
