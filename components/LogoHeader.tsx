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
          // Crop the full logo PNG (2550×3300) down to a generous window around
          // the hex + orange-stripe mark with breathing room on all sides.
          // Crop window: x 10–32%, y 3–20%  → square container 88×88.
          <div
            style={{
              width: 88,
              height: 88,
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0,
            }}
            aria-label="Lead It Builders"
            role="img"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lib_brand/lead_it_builders_logo.png"
              alt="Lead It Builders"
              onError={() => setImgError(true)}
              style={{
                position: 'absolute',
                width: 400,
                height: 'auto',
                left: -40,
                top: -16,
                maxWidth: 'none',
                userSelect: 'none',
              }}
              draggable={false}
            />
          </div>
        ) : (
          <svg width="88" height="88" viewBox="0 0 88 88" aria-label="LIB">
            <polygon
              points="44,12 70,26 70,62 44,76 18,62 18,26"
              fill="#000000"
            />
            <rect x="40" y="18" width="8" height="34" fill="#F47832" />
          </svg>
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
