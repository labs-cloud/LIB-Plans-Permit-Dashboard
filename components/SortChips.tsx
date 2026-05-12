'use client';

export type SortKey = 'urgency' | 'coord' | 'phase' | 'name' | 'activity';

interface Chip {
  id: SortKey;
  label: string;
  icon?: { name: string; color?: string };
}

const CHIPS: Chip[] = [
  { id: 'urgency', label: 'Urgency', icon: { name: 'ti-alert-circle', color: '#A32D2D' } },
  { id: 'coord', label: 'Coordinator', icon: { name: 'ti-user' } },
  { id: 'phase', label: 'Phase' },
  { id: 'name', label: 'Project A→Z' },
  { id: 'activity', label: 'Last activity' },
];

interface Props {
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}

export function SortChips({ sort, onSortChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sort by</span>
      {CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={`sort-chip ${sort === chip.id ? 'active' : ''}`}
          onClick={() => onSortChange(chip.id)}
        >
          {chip.icon ? (
            <i
              className={`ti ${chip.icon.name}`}
              style={{ fontSize: 13, verticalAlign: -2, color: chip.icon.color, marginRight: 4 }}
            />
          ) : null}
          {chip.label}
        </button>
      ))}
    </div>
  );
}
