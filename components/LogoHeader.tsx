'use client';

import { useState } from 'react';
import { DashboardSwitcher } from './DashboardSwitcher';
import { SyncButton } from './SyncButton';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  shownCount?: number;
  totalCount?: number;
  syncedAt: number | null;
  filterLine?: string | null;
  warning?: string | null;
  title?: string;
  subtitleOverride?: string;
}

function formatRelative(syncedAt: number | null): { label: string; stale: boolean } {
  if (!syncedAt) return { label: 'syncing…', stale: false };
  const mins = Math.max(0, Math.floor((Date.now() - syncedAt) / 60000));
  if (mins <= 2) return { label: `synced ${mins} min ago`, stale: false };
  return { label: `Stale · ${mins}m ago`, stale: true };
}

export function LogoHeader({
  shownCount,
  totalCount,
  syncedAt,
  filterLine,
  warning,
  title = 'Plans Dashboard',
  subtitleOverride,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const { label, stale } = formatRelative(syncedAt);

  const subtitle = (() => {
    if (warning) return warning;
    if (subtitleOverride) return `${subtitleOverride} · live from ClickUp · ${label}`;
    const base = `${shownCount} of ${totalCount} active projects · live from ClickUp · ${label}`;
    return filterLine ? `${shownCount} of ${totalCount} shown · ${filterLine} · ${label}` : base;
  })();

  return (
    <div
      className="dashboard-header"
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
      <div className="dashboard-header-logo" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {!imgError ? (
          // Crop the full logo PNG (2550×3300) down to a generous window around
          // the hex + orange-stripe mark with breathing room on all sides.
          // Crop window: x ~8–35%, y ~0–23% of the source.
          <div
            className="dashboard-logo-crop"
            style={{
              width: 96,
              height: 104,
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0,
            }}
            aria-label="Lead It Builders"
            role="img"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="dashboard-logo-img"
              src="/lib_brand/lead_it_builders_logo.png"
              alt="Lead It Builders"
              onError={() => setImgError(true)}
              style={{
                position: 'absolute',
                width: 360,
                height: 'auto',
                left: -30,
                top: -2,
                maxWidth: 'none',
                userSelect: 'none',
              }}
              draggable={false}
            />
          </div>
        ) : (
          <svg width="96" height="104" viewBox="0 0 96 104" aria-label="LIB">
            <polygon
              points="48,14 76,30 76,72 48,88 20,72 20,30"
              fill="#000000"
            />
            <rect x="44" y="6" width="8" height="44" fill="#F47832" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dashboard-title" style={{ fontSize: 18, fontWeight: 500, letterSpacing: 0.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>

      <div className="dashboard-header-actions">
        <DashboardSwitcher />
        <SyncButton />
        <ThemeToggle />
      </div>

      <div
        className="live-pill"
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
