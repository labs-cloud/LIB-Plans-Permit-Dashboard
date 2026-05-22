'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';

export function SyncButton() {
  const { mutate } = useSWRConfig();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(false);

  const handle = async () => {
    if (syncing) return;
    setSyncing(true);
    setError(false);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
      // Revalidate all dashboard API caches simultaneously
      await Promise.all([
        mutate('/api/projects'),
        mutate((key) => typeof key === 'string' && key.startsWith('/api/bidding')),
        mutate((key) => typeof key === 'string' && key.startsWith('/api/budget')),
      ]);
    } catch (err) {
      console.error(err);
      setError(true);
      window.setTimeout(() => setError(false), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const tooltip = error
    ? 'Sync failed — try again'
    : syncing
      ? 'Syncing from ClickUp…'
      : 'Sync from ClickUp now';

  return (
    <button
      type="button"
      onClick={handle}
      disabled={syncing}
      title={tooltip}
      aria-label={tooltip}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: error
          ? '#FCEBEB'
          : syncing
            ? 'var(--color-background-tertiary)'
            : 'var(--color-background-secondary)',
        border: '0.5px solid var(--color-border-tertiary)',
        cursor: syncing ? 'wait' : 'pointer',
        color: error ? '#A32D2D' : 'var(--color-text-primary)',
      }}
    >
      <i
        className="ti ti-refresh"
        style={{
          fontSize: 18,
          display: 'inline-block',
          animation: syncing ? 'lib-spin 1s linear infinite' : 'none',
        }}
      />
    </button>
  );
}
