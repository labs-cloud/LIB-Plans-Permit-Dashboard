'use client';

import { useEffect, useRef, useState } from 'react';

export type DetailedLayout = 'A' | 'B' | 'C' | 'D';
export type ChipStyle = 'solid' | 'dot' | 'stripe';

interface Props {
  layout: DetailedLayout;
  chipStyle: ChipStyle;
  onLayoutChange: (l: DetailedLayout) => void;
  onChipStyleChange: (c: ChipStyle) => void;
}

const LAYOUT_OPTIONS: { id: DetailedLayout; label: string; hint: string }[] = [
  { id: 'A', label: 'Current', hint: 'Filings in natural order' },
  { id: 'B', label: 'Triage-first', hint: 'Waiting on → Approved' },
  { id: 'C', label: 'Lanes by status', hint: 'Grouped sub-rows' },
  { id: 'D', label: 'Compact row', hint: 'One line per project' },
];

const CHIP_OPTIONS: { id: ChipStyle; label: string; hint: string }[] = [
  { id: 'solid', label: 'Solid', hint: 'Tinted bubble' },
  { id: 'dot', label: 'Dot', hint: 'White + colored dot' },
  { id: 'stripe', label: 'Stripe', hint: 'Edge-bar tag' },
];

export function ViewSettings({
  layout,
  chipStyle,
  onLayoutChange,
  onChipStyleChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeLayout = LAYOUT_OPTIONS.find((l) => l.id === layout);
  const isDefault = layout === 'A' && chipStyle === 'solid';

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change layout and chip style"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 10px',
          background: isDefault
            ? 'var(--color-background-secondary)'
            : 'var(--color-background-primary)',
          border: `0.5px solid ${
            isDefault ? 'transparent' : 'var(--lib-orange)'
          }`,
          borderRadius: 'var(--border-radius-md)',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <i className="ti ti-adjustments-horizontal" style={{ fontSize: 14 }} />
        {activeLayout?.label}
        <i
          className={`ti ti-chevron-${open ? 'up' : 'down'}`}
          style={{ fontSize: 12, opacity: 0.6 }}
        />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 50,
            width: 260,
            padding: 12,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          }}
        >
          <Section title="Layout">
            {LAYOUT_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.id}
                active={opt.id === layout}
                label={opt.label}
                hint={opt.hint}
                onClick={() => onLayoutChange(opt.id)}
              />
            ))}
          </Section>
          <Section title="Chip style">
            {CHIP_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.id}
                active={opt.id === chipStyle}
                label={opt.label}
                hint={opt.hint}
                onClick={() => onChipStyleChange(opt.id)}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
          fontWeight: 600,
          padding: '6px 6px 4px',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

interface OptionButtonProps {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}

function OptionButton({ active, label, hint, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        background: active ? 'var(--color-background-secondary)' : 'transparent',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <i
        className={`ti ${active ? 'ti-circle-check-filled' : 'ti-circle'}`}
        style={{
          fontSize: 14,
          color: active ? 'var(--lib-orange)' : 'var(--color-text-tertiary)',
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 12.5,
            fontWeight: active ? 600 : 500,
            color: 'var(--color-text-primary)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
          }}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}
