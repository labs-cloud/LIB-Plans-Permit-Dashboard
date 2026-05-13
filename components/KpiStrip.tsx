import type { KpiStripData } from '@/lib/types';

interface KpiCardProps {
  label: string;
  value: number | string;
  valueColor?: string;
  iconClass: string;
  iconTint: string;
}

function KpiCard({ label, value, valueColor, iconClass, iconTint }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 500, color: valueColor, lineHeight: 1.1 }}>
          {value}
        </div>
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: `${iconTint}1A`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <i className={`ti ${iconClass}`} style={{ fontSize: 22, color: iconTint }} />
      </div>
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
        iconClass="ti-file-text"
        iconTint="#185fa5"
      />
      <KpiCard
        label="Approved · 7d"
        value={data.approved7d}
        valueColor="#173404"
        iconClass="ti-circle-check"
        iconTint="#3B6D11"
      />
      <KpiCard
        label="Waiting on"
        value={data.waitingOn}
        valueColor="#854F0B"
        iconClass="ti-clock-pause"
        iconTint="#BA7517"
      />
      <KpiCard
        label="Expiring · 30d"
        value={data.expiring30d}
        valueColor="#854F0B"
        iconClass="ti-alert-triangle"
        iconTint="#BA7517"
      />
      <KpiCard
        label="Expired · stop work"
        value={data.expired}
        valueColor="#791F1F"
        iconClass="ti-alert-octagon"
        iconTint="#A32D2D"
      />
    </div>
  );
}
