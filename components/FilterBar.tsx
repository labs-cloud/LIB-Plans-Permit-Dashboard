'use client';

import type { CoordinatorId, PhaseId } from '@/lib/constants';

export type ViewMode = 'overview' | 'detailed' | 'matrix';

interface Props {
  search: string;
  coord: CoordinatorId | 'all';
  phase: PhaseId | 'all';
  assetType: string | 'all';
  assetTypeOptions: string[];
  view: ViewMode;
  defaultView: ViewMode;
  onSearchChange: (s: string) => void;
  onCoordChange: (c: CoordinatorId | 'all') => void;
  onPhaseChange: (p: PhaseId | 'all') => void;
  onAssetTypeChange: (s: string | 'all') => void;
  onViewChange: (v: ViewMode) => void;
  onSetDefaultView: (v: ViewMode | null) => void;
}

const VIEW_TABS: { id: ViewMode; icon: string; label: string }[] = [
  { id: 'overview', icon: 'ti-grid-dots', label: 'Overview' },
  { id: 'detailed', icon: 'ti-list-details', label: 'Detailed' },
  { id: 'matrix', icon: 'ti-table', label: 'Matrix' },
];

export function FilterBar({
  search,
  coord,
  phase,
  assetType,
  assetTypeOptions,
  view,
  defaultView,
  onSearchChange,
  onCoordChange,
  onPhaseChange,
  onAssetTypeChange,
  onViewChange,
  onSetDefaultView,
}: Props) {
  const isDefault = view === defaultView;
  const pinLabel = isDefault
    ? `${VIEW_TABS.find((t) => t.id === view)?.label} is your default — click to clear`
    : `Set ${VIEW_TABS.find((t) => t.id === view)?.label} as the default view on launch`;
  return (
    <div
      className="filter-bar"
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <input
        className="filter-search"
        type="search"
        placeholder="Search projects…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ flex: 1, minWidth: 160, maxWidth: 220, fontSize: 13 }}
      />
      <select
        className="filter-select"
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
        className="filter-select"
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
        className="filter-select"
        value={assetType}
        onChange={(e) => onAssetTypeChange(e.target.value)}
        title="Filter plans by Asset Type"
        style={{
          fontSize: 13,
          background: assetType !== 'all' ? '#FEF1E5' : undefined,
          color: assetType !== 'all' ? '#7A3A11' : undefined,
          fontWeight: assetType !== 'all' ? 500 : undefined,
          borderColor: assetType !== 'all' ? '#F4A973' : undefined,
        }}
      >
        <option value="all">All asset types</option>
        {assetTypeOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <div
        className="view-toggle-wrap"
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          marginLeft: 'auto',
        }}
      >
        <div
          className="view-toggle"
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          {VIEW_TABS.map((tab) => {
            const active = view === tab.id;
            const tabIsDefault = defaultView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`tab ${active ? 'active' : ''}`}
                onClick={() => onViewChange(tab.id)}
                title={tabIsDefault ? `${tab.label} (default)` : tab.label}
                style={{ position: 'relative' }}
              >
                <i
                  className={`ti ${tab.icon}`}
                  style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }}
                />
                {tab.label}
                {tabIsDefault && (
                  <i
                    className="ti ti-pin-filled"
                    aria-hidden="true"
                    style={{
                      fontSize: 10,
                      marginLeft: 5,
                      color: 'var(--lib-orange)',
                      verticalAlign: 1,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="filter-pin-default"
          onClick={() => onSetDefaultView(isDefault ? null : view)}
          title={pinLabel}
          aria-label={pinLabel}
          aria-pressed={isDefault}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            border: `0.5px solid ${
              isDefault ? 'var(--lib-orange)' : 'var(--color-border-secondary)'
            }`,
            background: isDefault
              ? '#FEF1E5'
              : 'var(--color-background-primary)',
            color: isDefault ? '#7A3A11' : 'var(--color-text-secondary)',
            borderRadius: 'var(--border-radius-md)',
            cursor: 'pointer',
          }}
        >
          <i
            className={`ti ${isDefault ? 'ti-pin-filled' : 'ti-pin'}`}
            style={{ fontSize: 15 }}
          />
        </button>
      </div>
    </div>
  );
}
