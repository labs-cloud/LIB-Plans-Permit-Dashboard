'use client';

import type { KpiStripData, PermitsPanelData, StickingItem } from '@/lib/types';
import { taskUrl } from '@/lib/urls';

interface Props {
  kpis: KpiStripData;
  sticking: StickingItem[];
  permits: PermitsPanelData;
}

interface FeatureCopy {
  head: string;
  title: string;
}

function featureCopy(sticking: StickingItem[]): FeatureCopy {
  if (sticking.length === 0) {
    return {
      head: 'all clear',
      title: 'Nothing in the sticking queue — every filing and permit is healthy',
    };
  }
  const expired = sticking.filter((s) => s.severity === 1);
  const waitingOn = sticking.filter((s) => s.severity === 3 || s.severity === 5);
  const expiring = sticking.filter((s) => s.severity === 2 || s.severity === 4);
  const avg = Math.round(
    sticking.reduce((sum, s) => sum + s.daysStuck, 0) / sticking.length,
  );

  if (expired.length > 0) {
    return {
      head: 'act now',
      title: `${expired.length} permit${expired.length === 1 ? '' : 's'} expired — stop-work risk`,
    };
  }
  if (waitingOn.length > 0) {
    return {
      head: 'top of the queue',
      title: `${waitingOn.length} filing${waitingOn.length === 1 ? '' : 's'} waiting on agencies — avg ${avg} days stuck`,
    };
  }
  return {
    head: 'top of the queue',
    title: `${expiring.length} permit${expiring.length === 1 ? '' : 's'} in the renewal window`,
  };
}

interface TileSpec {
  key: keyof KpiStripData | 'active';
  icon: string;
  label: string;
  value: number;
  sub: string;
  tone?: 'good' | 'warn' | 'danger';
}

function toneVars(tone?: TileSpec['tone']): {
  background: string;
  valueColor?: string;
  headColor?: string;
} {
  if (tone === 'good') {
    return {
      background: 'var(--good-bg)',
      valueColor: 'var(--good-strong)',
      headColor: 'var(--good-fg)',
    };
  }
  if (tone === 'warn') {
    return {
      background: 'var(--warn-bg)',
      valueColor: 'var(--warn-strong)',
      headColor: 'var(--warn-fg)',
    };
  }
  if (tone === 'danger') {
    return {
      background: 'var(--danger-bg)',
      valueColor: 'var(--danger-strong)',
      headColor: 'var(--danger-fg)',
    };
  }
  return { background: 'var(--color-background-secondary)' };
}

export function HeroMosaic({ kpis, sticking, permits }: Props) {
  const copy = featureCopy(sticking);
  const featured = sticking.slice(0, 3);

  const tiles: TileSpec[] = [
    {
      key: 'filingsInFlight',
      icon: 'ti-file-text',
      label: 'Filings in flight',
      value: kpis.filingsInFlight,
      sub: 'across all phases',
    },
    {
      key: 'approved7d',
      icon: 'ti-circle-check',
      label: 'Approved · 7d',
      value: kpis.approved7d,
      sub: 'last seven days',
      tone: 'good',
    },
    {
      key: 'waitingOn',
      icon: 'ti-clock-pause',
      label: 'Waiting on',
      value: kpis.waitingOn,
      sub: 'agency response',
      tone: 'warn',
    },
    {
      key: 'expiring30d',
      icon: 'ti-alert-triangle',
      label: 'Expiring · 30d',
      value: kpis.expiring30d,
      sub: 'renewal window',
      tone: 'warn',
    },
    {
      key: 'expired',
      icon: 'ti-alert-circle',
      label: 'Expired',
      value: kpis.expired,
      sub: 'stop-work risk',
      tone: 'danger',
    },
    {
      key: 'active',
      icon: 'ti-license',
      label: 'Active permits',
      value: permits.active,
      sub: `across ${permits.activeProjects} project${permits.activeProjects === 1 ? '' : 's'}`,
    },
  ];

  return (
    <section
      className="hero-mosaic"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
        gridTemplateRows: 'auto auto',
        gap: 14,
        marginBottom: '1.25rem',
      }}
    >
      {/* Feature tile */}
      <div
        className="hero-feature"
        style={{
          gridRow: '1 / span 2',
          background:
            'linear-gradient(160deg, var(--lib-softblack), #2a2425 60%, #1a1717)',
          color: '#fff',
          borderRadius: 'var(--border-radius-lg)',
          padding: '22px 24px',
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          <span
            style={{
              color: 'var(--lib-orange)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Priority
          </span>
          <span>· {copy.head}</span>
        </div>
        <h2
          style={{
            margin: '16px 0 12px',
            fontSize: 28,
            lineHeight: 1.15,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            maxWidth: '24ch',
          }}
        >
          {copy.title}
        </h2>
        {featured.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginTop: 'auto',
              paddingTop: 12,
            }}
          >
            {featured.map((item) => (
              <a
                key={item.taskId}
                href={taskUrl(item.taskId)}
                target="_blank"
                rel="noopener"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(244,120,50,0.18)',
                    color: 'var(--lib-orange)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {item.daysStuck}d
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <strong style={{ fontWeight: 500 }}>{item.projectName}</strong>
                  {' · '}
                  {item.text}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 6 KPI tiles */}
      {tiles.map((spec) => {
        const tone = toneVars(spec.tone);
        return (
          <div
            key={spec.key}
            className="hero-tile"
            style={{
              background: tone.background,
              borderRadius: 'var(--border-radius-lg)',
              padding: '22px 24px',
              minHeight: 130,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: tone.headColor ?? 'var(--color-text-secondary)',
              }}
            >
              <i className={`ti ${spec.icon}`} style={{ fontSize: 14 }} />
              <span>{spec.label}</span>
            </div>
            <div>
              <div
                style={{
                  fontSize: 46,
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  color: tone.valueColor,
                }}
              >
                {spec.value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-tertiary)',
                  marginTop: 4,
                }}
              >
                {spec.sub}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
