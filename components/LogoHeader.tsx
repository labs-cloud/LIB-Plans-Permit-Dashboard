'use client';

import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  shownCount: number;
  totalCount: number;
  syncedAt: number | null;
  filterLine?: string | null;
  warning?: string | null;
}

function formatRelative(syncedAt: number | null): { label: string; stale: boolean } {
  if (!syncedAt) return { label: 'syncing…', stale: false };
  const mins = Math.max(0, Math.floor((Date.now() - syncedAt) / 60000));
  if (mins <= 2) return { label: `synced ${mins} min ago`, stale: false };
  return { label: `Stale · ${mins}m ago`, stale: true };
}

export function LogoHeader({ shownCount, totalCount, syncedAt, filterLine, warning }: Props) {
  const [imgError, setImgError] = useState(false);
  const { label, stale } = formatRelative(syncedAt);

  const subtitle = (() => {
    if (warning) return warning;
    const base = `${shownCount} of ${totalCount} active projects · live from ClickUp · ${label}`;
    return filterLine ? `${shownCount} of ${totalCount} shown · ${filterLine} · ${label}` : base;
  })();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 20px',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        marginBottom: '1.25rem',
        borderTop: '3px solid #F47832',
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/lib_brand/lead_it_builders_logo.png"
            alt="Lead It Builders"
            style={{ height: 48, width: 'auto', objectFit: 'contain' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" aria-label="LIB">
              <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill="#000000" />
              <rect x="22" y="8" width="4" height="20" fill="#F47832" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
              LEAD IT BUILDERS
            </span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: 0.2 }}>
          Plans &amp; Permits Dashboard
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>

      <ThemeToggle />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          whiteSpace: 'nowrap',
          padding: '5px 12px',
          background: stale ? '#FAEEDA' : '#EAF3DE',
          borderRadius: 999,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: stale ? '#BA7517' : '#639922',
          }}
        />
        <span style={{ color: stale ? '#412402' : '#173404', fontWeight: 500 }}>
          {stale ? 'Stale' : 'Live'}
        </span>
      </div>
    </div>
  );
}
