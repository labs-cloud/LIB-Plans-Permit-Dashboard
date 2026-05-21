'use client';

// Bidding Dashboard — full implementation in progress.
// This stub keeps the /bidding route live while the component is being built.

export function BiddingDashboard() {
  return (
    <div
      className="dashboard-shell"
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '3rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '999px',
          background: 'var(--color-background-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <i className="ti ti-gavel" style={{ fontSize: 22, color: 'var(--color-text-tertiary)' }} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500 }}>Bidding Dashboard</h2>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
        Trade × subcontractor matrix · 8-color bidding status palette
        <br />
        Implementation in progress…
      </p>
    </div>
  );
}
