export function DashboardSkeleton() {
  return (
    <div>
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
        <div className="skeleton" style={{ width: 48, height: 48 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: 220, height: 18 }} />
          <div className="skeleton" style={{ width: 280, height: 12, marginTop: 6 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 88, marginBottom: '1.25rem' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
          marginBottom: '1.25rem',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 76 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 480 }} />
    </div>
  );
}
