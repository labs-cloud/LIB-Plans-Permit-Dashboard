import type { KpiStripData } from '@/lib/types';

interface KpiCardProps {
  label: string;
  value: number | string;
  color?: string;
  trendStroke: string;
  trendPoints: string;
}

function KpiCard({ label, value, color, trendStroke, trendPoints }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color }}>{value}</div>
      <svg viewBox="0 0 60 16" style={{ width: '100%', height: 16, marginTop: 4 }}>
        <polyline points={trendPoints} fill="none" stroke={trendStroke} strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function KpiStrip({ data }: { data: KpiStripData }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 10,
        marginBottom: '1.25rem',
      }}
    >
      <KpiCard
        label="Filings in flight"
        value={data.filingsInFlight}
        trendStroke="#185fa5"
        trendPoints="0,12 10,10 20,11 30,7 40,8 50,5 60,4"
      />
      <KpiCard
        label="Approved · 7d"
        value={data.approved7d}
        color="#173404"
        trendStroke="#3B6D11"
        trendPoints="0,12 10,11 20,9 30,10 40,7 50,5 60,3"
      />
      <KpiCard
        label="Waiting on"
        value={data.waitingOn}
        color="#854F0B"
        trendStroke="#BA7517"
        trendPoints="0,4 10,5 20,8 30,7 40,9 50,10 60,8"
      />
      <KpiCard
        label="Expiring · 30d"
        value={data.expiring30d}
        color="#854F0B"
        trendStroke="#BA7517"
        trendPoints="0,9 10,8 20,7 30,6 40,5 50,4 60,3"
      />
      <KpiCard
        label="Expired · stop work"
        value={data.expired}
        color="#791F1F"
        trendStroke="#A32D2D"
        trendPoints="0,13 10,13 20,12 30,11 40,10 50,9 60,9"
      />
    </div>
  );
}
