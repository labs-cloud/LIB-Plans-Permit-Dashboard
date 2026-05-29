'use client';

import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';

interface Props {
  syncedAt: number | null;
}

function formatRelative(syncedAt: number | null, now: number): { label: string; stale: boolean } {
  if (!syncedAt) return { label: 'syncing…', stale: false };
  const mins = Math.max(0, Math.floor((now - syncedAt) / 60000));
  if (mins <= 2) return { label: `synced ${mins}m ago`, stale: false };
  return { label: `stale · ${mins}m ago`, stale: true };
}

export function EmbedSyncBar({ syncedAt }: Props) {
  const { mutate } = useSWRConfig();
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { label, stale } = formatRelative(syncedAt, now);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
      await Promise.all([
        mutate('/api/projects'),
        mutate((key) => typeof key === 'string' && key.startsWith('/api/bidding')),
        mutate((key) => typeof key === 'string' && key.startsWith('/api/budget')),
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        marginBottom: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          padding: '4px 10px',
          background: stale ? '#FAEEDA' : '#EAF3DE',
          borderRadius: 999,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: stale ? '#BA7517' : '#639922',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={{ color: stale ? '#412402' : '#173404', fontWeight: 500 }}>
          {stale ? 'Stale' : 'Live'}
        </span>
        <span style={{ color: stale ? '#6B3A0F' : '#2A5210' }}>· {label}</span>
      </div>

      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        title={syncing ? 'Syncing from ClickUp…' : 'Sync from ClickUp now'}
        aria-label={syncing ? 'Syncing from ClickUp…' : 'Sync from ClickUp now'}
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
          cursor: syncing ? 'wait' : 'pointer',
          color: 'var(--color-text-primary)',
          flexShrink: 0,
        }}
      >
        <i
          className="ti ti-refresh"
          style={{
            fontSize: 15,
            display: 'inline-block',
            animation: syncing ? 'lib-spin 1s linear infinite' : 'none',
          }}
        />
      </button>
    </div>
  );
}
