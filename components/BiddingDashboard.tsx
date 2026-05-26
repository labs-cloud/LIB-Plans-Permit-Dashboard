'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { LogoHeader } from './LogoHeader';
import type { BidStatus, BidSub, BidTrade, BiddingPayload } from '@/lib/bidding-types';

// ─── Data context (replaces static fixture import) ────────────────────────────

const BiddingCtx = createContext<BiddingPayload | null>(null);

function useBidding(): BiddingPayload {
  const ctx = useContext(BiddingCtx);
  if (!ctx) throw new Error('useBidding must be used inside BiddingDashboard');
  return ctx;
}

async function fetcher(url: string): Promise<BiddingPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json() as Promise<BiddingPayload>;
}

// ─── Status metadata ──────────────────────────────────────────────────────────

type StatusMeta = {
  label: string;
  icon: string;
  bg: string;
  fg: string;
  ring: string;
  strong: string;
};

const STATUS_META: Record<BidStatus, StatusMeta> = {
  ntb: { label: 'Not bidding', icon: 'ti-ban',        bg: 'var(--bid-ntb-bg)', fg: 'var(--bid-ntb-fg)', ring: 'var(--bid-ntb-ring)', strong: 'var(--bid-ntb-strong)' },
  snt: { label: 'Sent',        icon: 'ti-send',        bg: 'var(--bid-snt-bg)', fg: 'var(--bid-snt-fg)', ring: 'var(--bid-snt-ring)', strong: 'var(--bid-snt-strong)' },
  rec: { label: 'Received',    icon: 'ti-checks',      bg: 'var(--bid-rec-bg)', fg: 'var(--bid-rec-fg)', ring: 'var(--bid-rec-ring)', strong: 'var(--bid-rec-strong)' },
  hld: { label: 'Hold',        icon: 'ti-hand-stop',   bg: 'var(--bid-hld-bg)', fg: 'var(--bid-hld-fg)', ring: 'var(--bid-hld-ring)', strong: 'var(--bid-hld-strong)' },
  fnl: { label: 'Finalized',   icon: 'ti-trophy',      bg: 'var(--bid-fnl-bg)', fg: 'var(--bid-fnl-fg)', ring: 'var(--bid-fnl-ring)', strong: 'var(--bid-fnl-strong)' },
  fu1: { label: 'FU·W1 (14d ago)', icon: 'ti-message-2', bg: 'var(--bid-fu1-bg)', fg: 'var(--bid-fu1-fg)', ring: 'var(--bid-fu1-ring)', strong: 'var(--bid-fu1-strong)' },
  fu2: { label: 'FU·W2 (7d ago)',  icon: 'ti-message-2', bg: 'var(--bid-fu2-bg)', fg: 'var(--bid-fu2-fg)', ring: 'var(--bid-fu2-ring)', strong: 'var(--bid-fu2-strong)' },
  fu3: { label: 'FU·W3 (0d ago)',  icon: 'ti-message-2', bg: 'var(--bid-fu3-bg)', fg: 'var(--bid-fu3-fg)', ring: 'var(--bid-fu3-ring)', strong: 'var(--bid-fu3-strong)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtLong$(n: number): string {
  return `$${n.toLocaleString()}`;
}

/** Priority-based trade-level status derivation */
function tradeStatus(trade: BidTrade): BidStatus | null {
  const s = trade.subs.map((sub) => sub.status);
  if (s.includes('fnl')) return 'fnl';
  if (s.includes('hld')) return 'hld';
  if (s.length > 0 && s.every((x) => x === 'ntb')) return 'ntb';
  if (s.some((x) => x === 'fu1' || x === 'fu2' || x === 'fu3')) return 'fu1';
  if (s.includes('rec')) return 'rec';
  if (s.includes('snt')) return 'snt';
  return null;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status, small }: { status: BidStatus; small?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: small ? '2px 8px 2px 6px' : '3px 10px 3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        border: `1px solid ${m.ring}`,
        background: m.bg,
        color: m.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: m.strong,
          flexShrink: 0,
        }}
      />
      {m.label}
    </span>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────────────────

type KpiTone = 'info' | 'amber' | 'good' | 'danger';

const TONE_STYLES: Record<KpiTone, { fg: string; iconColor: string; iconBg: string }> = {
  info:   { fg: 'var(--info-fg)',   iconColor: 'var(--info-strong)',   iconBg: 'rgba(24,95,165,0.10)'  },
  amber:  { fg: 'var(--warn-fg)',   iconColor: 'var(--warn-strong)',   iconBg: 'rgba(186,117,23,0.10)' },
  good:   { fg: 'var(--good-fg)',   iconColor: 'var(--good-strong)',   iconBg: 'rgba(59,109,17,0.10)'  },
  danger: { fg: 'var(--danger-fg)', iconColor: 'var(--danger-strong)', iconBg: 'rgba(163,45,45,0.10)'  },
};

function KpiCard({
  label,
  caption,
  value,
  icon,
  tone,
}: {
  label: string;
  caption: string;
  value: string | number;
  icon: string;
  tone: KpiTone;
}) {
  const ts = TONE_STYLES[tone];
  return (
    <div
      style={{
        background: 'var(--color-background-secondary)',
        border: '0.5px solid transparent',
        borderRadius: 'var(--border-radius-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-secondary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.015em',
            color: ts.fg,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 11, color: ts.iconColor, marginTop: 2 }}>{caption}</div>
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: ts.iconBg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 20, color: ts.iconColor }} />
      </div>
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '18px 20px',
        marginBottom: '1.25rem',
      }}
    >
      <h2
        style={{
          margin: '0 0 14px',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 15, color: 'var(--lib-orange)' }} />
        {title}
        {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
      </h2>
      {children}
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

type DrawerPayload =
  | { type: 'sub'; trade: BidTrade; sub: BidSub }
  | { type: 'trade'; trade: BidTrade };

function Drawer({ payload, onClose }: { payload: DrawerPayload; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lowestAmount = payload.trade.low;
  const lowestSub = payload.trade.subs.find(
    (s) => s.amount === lowestAmount && lowestAmount !== null,
  );

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 900,
        }}
      />
      {/* panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 95vw)',
          background: 'var(--color-background-primary)',
          borderLeft: '0.5px solid var(--color-border-secondary)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {payload.type === 'sub' ? payload.sub.name : payload.trade.trade}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {payload.type === 'sub' ? (
                <>
                  <span>{payload.trade.trade}</span>
                  <StatusPill status={payload.sub.status} small />
                </>
              ) : (
                <span>800 Brady · bid timeline</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 15 }} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '16px 18px', flex: 1 }}>
          {payload.type === 'sub' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}
                >
                  BID AMOUNT
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color:
                      payload.sub.amount !== null
                        ? 'var(--good-fg)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {payload.sub.amount !== null ? fmtLong$(payload.sub.amount) : 'Not submitted'}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}
                >
                  STATUS
                </div>
                <StatusPill status={payload.sub.status} />
              </div>
              {payload.sub.amount !== null && lowestSub?.name === payload.sub.name && (
                <div
                  style={{
                    background: 'var(--good-bg)',
                    color: 'var(--good-fg)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  <i className="ti ti-award" style={{ fontSize: 14 }} />
                  Lowest bid for this trade
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}
                >
                  BID HISTORY TIMELINE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--color-text-tertiary)',
                      }}
                    />
                    <span style={{ color: 'var(--color-text-tertiary)' }}>
                      Scope sent to subcontractor
                    </span>
                  </div>
                  {(payload.sub.status === 'fu1' ||
                    payload.sub.status === 'fu2' ||
                    payload.sub.status === 'fu3') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: STATUS_META[payload.sub.status].strong,
                        }}
                      />
                      <span style={{ color: STATUS_META[payload.sub.status].fg }}>
                        Follow-up sent
                      </span>
                    </div>
                  )}
                  {payload.sub.amount !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--good-strong)',
                        }}
                      />
                      <span style={{ color: 'var(--good-fg)' }}>
                        Bid received · {fmtLong$(payload.sub.amount)}
                      </span>
                    </div>
                  )}
                  {payload.sub.status === 'fnl' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--bid-fnl-strong)',
                        }}
                      />
                      <span style={{ color: 'var(--bid-fnl-fg)', fontWeight: 600 }}>
                        Finalized
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}
                >
                  OPEN IN CLICKUP
                </div>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: 'var(--color-text-info)',
                    padding: '6px 12px',
                    border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 6,
                  }}
                >
                  <i className="ti ti-external-link" style={{ fontSize: 14 }} />
                  Open task
                </a>
              </div>
            </>
          ) : (
            <>
              {lowestAmount !== null && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}
                  >
                    RUNNING LOWEST
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--good-fg)',
                    }}
                  >
                    {fmtLong$(lowestAmount)}
                  </div>
                  {lowestSub && (
                    <div
                      style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}
                    >
                      {lowestSub.name}
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}
                >
                  SUBS ({payload.trade.subs.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {payload.trade.subs.map((sub, i) => {
                    const isLow = sub.amount !== null && sub.amount === lowestAmount;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: isLow
                            ? 'var(--good-bg)'
                            : 'var(--color-background-secondary)',
                          borderRadius: 6,
                          border: `0.5px solid ${isLow ? 'var(--good-strong)' : 'var(--color-border-tertiary)'}`,
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{sub.name}</div>
                          {sub.amount !== null && (
                            <div
                              style={{
                                fontSize: 11,
                                color: isLow
                                  ? 'var(--good-strong)'
                                  : 'var(--color-text-secondary)',
                              }}
                            >
                              {fmtLong$(sub.amount)}
                              {isLow && ' · lowest'}
                            </div>
                          )}
                        </div>
                        <StatusPill status={sub.status} small />
                      </div>
                    );
                  })}
                  {payload.trade.subs.length === 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-tertiary)',
                        fontStyle: 'italic',
                      }}
                    >
                      No subs entered yet
                    </div>
                  )}
                </div>
              </div>
              {payload.trade.annot && (
                <div
                  style={{
                    background: 'var(--warn-bg)',
                    color: 'var(--warn-fg)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  <i className="ti ti-info-circle" style={{ fontSize: 14 }} />
                  {payload.trade.annot}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Overview view ────────────────────────────────────────────────────────────

function OverviewView({ onGoDetailed }: { onGoDetailed: () => void }) {
  const { project, portfolioProjects } = useBidding();
  const trades = project.trades;

  const kpis = useMemo(() => {
    const notFnl = trades.filter(
      (t) => !t.subs.some((s) => s.status === 'fnl') || t.subs.length === 0,
    ).length;
    const committed = trades.reduce((acc, t) => acc + (t.low ?? 0), 0);
    const fuCount = trades.filter((t) =>
      t.subs.some(
        (s) => s.status === 'fu1' || s.status === 'fu2' || s.status === 'fu3',
      ),
    ).length;
    return { notFnl, committed, fuCount };
  }, [trades]);

  return (
    <>
      {/* KPI strip */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: '1.25rem',
        }}
      >
        <KpiCard
          label="Projects in bidding"
          caption="active this cycle"
          value={1}
          icon="ti-building-skyscraper"
          tone="info"
        />
        <KpiCard
          label="Trades not yet finalized"
          caption={`${kpis.notFnl} of ${trades.length} trades`}
          value={kpis.notFnl}
          icon="ti-clock"
          tone="amber"
        />
        <KpiCard
          label="Total committed (lowest)"
          caption="running sum · lowest bids"
          value={fmt$(kpis.committed)}
          icon="ti-cash"
          tone="good"
        />
        <KpiCard
          label="In follow-up this week"
          caption="fu1 / fu2 / fu3 subs"
          value={kpis.fuCount}
          icon="ti-message-2"
          tone="danger"
        />
      </div>

      {/* Matrix */}
      <SectionCard
        title="Portfolio bidding matrix"
        icon="ti-table"
        action={
          <button
            type="button"
            onClick={onGoDetailed}
            style={{
              fontSize: 11,
              color: 'var(--color-text-info)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
            }}
          >
            View detailed{' '}
            <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
          </button>
        }
      >
        <div style={{ overflowX: 'auto' }} className="matrix-scroll">
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <colgroup>
              <col style={{ minWidth: 200 }} />
              {portfolioProjects.slice(0, 8).map((_, i) => (
                <col key={i} style={{ minWidth: 120 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 600,
                    background: 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                  }}
                >
                  Trade
                </th>
                {portfolioProjects.slice(0, 8).map((proj, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: 'center',
                      padding: '8px 10px',
                      fontSize: 10,
                      letterSpacing: '0.04em',
                      color: proj.isReal
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-tertiary)',
                      fontWeight: proj.isReal ? 600 : 400,
                      background: 'var(--color-background-secondary)',
                      border: '0.5px solid var(--color-border-tertiary)',
                      whiteSpace: 'nowrap',
                      cursor: proj.isReal ? 'pointer' : 'default',
                    }}
                    onClick={proj.isReal ? onGoDetailed : undefined}
                    title={
                      proj.isReal
                        ? `Click to view ${proj.name} detailed`
                        : proj.location
                    }
                  >
                    {proj.isReal && (
                      <span style={{ color: 'var(--lib-orange)' }}>★ </span>
                    )}
                    {proj.name}
                    <div
                      style={{
                        fontSize: 9,
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 400,
                      }}
                    >
                      {proj.location}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, ti) => {
                const ts = tradeStatus(trade);
                const isHld = ts === 'hld';
                const isFuOrSnt = ts === 'fu1' || ts === 'snt';
                return (
                  <tr key={ti}>
                    <td
                      style={{
                        padding: '7px 12px',
                        border: '0.5px solid var(--color-border-tertiary)',
                        background: 'var(--color-background-primary)',
                        fontWeight: 500,
                        fontSize: 12,
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        borderLeft: isHld
                          ? '3px solid var(--bid-hld-ring)'
                          : isFuOrSnt
                          ? '3px solid var(--warn-strong)'
                          : '0.5px solid var(--color-border-tertiary)',
                        paddingLeft: isHld || isFuOrSnt ? 10 : 12,
                      }}
                    >
                      {trade.trade}
                    </td>
                    {portfolioProjects.slice(0, 8).map((proj, pi) => {
                      if (!proj.isReal) {
                        return (
                          <td
                            key={pi}
                            style={{
                              padding: '7px 10px',
                              border: '0.5px solid var(--color-border-tertiary)',
                              textAlign: 'center',
                              color: 'var(--color-text-tertiary)',
                              fontSize: 11,
                              fontStyle: 'italic',
                            }}
                          >
                            pending
                          </td>
                        );
                      }
                      const lowSub = trade.subs.find(
                        (s) => s.amount === trade.low && trade.low !== null,
                      );
                      return (
                        <td
                          key={pi}
                          style={{
                            padding: '7px 10px',
                            border: '0.5px solid var(--color-border-tertiary)',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {ts ? (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <StatusPill status={ts} small />
                              {trade.low !== null && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: 'var(--good-fg)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {fmt$(trade.low)}
                                </span>
                              )}
                              {lowSub && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: 'var(--color-text-tertiary)',
                                  }}
                                >
                                  {lowSub.name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}
                            >
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 14,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
          }}
        >
          {(Object.keys(STATUS_META) as BidStatus[]).map((st) => {
            const m = STATUS_META[st];
            return (
              <span
                key={st}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: m.bg,
                    border: `1px solid ${m.ring}`,
                  }}
                />
                {m.label}
              </span>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}

// ─── Detailed view ────────────────────────────────────────────────────────────

type FilterKey = 'all' | BidStatus | 'fu';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'snt', label: 'Sent' },
  { key: 'rec', label: 'Received' },
  { key: 'hld', label: 'Hold' },
  { key: 'fnl', label: 'Finalized' },
  { key: 'fu', label: 'Follow-up' },
];

function DetailedView({ onBack, search = '' }: { onBack: () => void; search?: string }) {
  const { project } = useBidding();
  const trades = project.trades;

  const [filter, setFilter] = useState<FilterKey>('all');
  const [drawer, setDrawer] = useState<DrawerPayload | null>(null);

  const kpis = useMemo(() => {
    const fnlCount = trades.filter((t) => t.subs.some((s) => s.status === 'fnl')).length;
    const outCount = trades.filter((t) =>
      t.subs.some((s) => s.status === 'snt' || s.status === 'rec'),
    ).length;
    const hldCount = trades.filter((t) => t.subs.some((s) => s.status === 'hld')).length;
    const ntbCount = trades.filter(
      (t) => t.subs.length > 0 && t.subs.every((s) => s.status === 'ntb'),
    ).length;
    const total = trades.reduce((a, t) => a + (t.low ?? 0), 0);
    const avgSubs =
      trades.length
        ? (trades.reduce((a, t) => a + t.subs.length, 0) / trades.length).toFixed(1)
        : '0';
    return {
      total: trades.length,
      fnlCount,
      outCount,
      hldCount,
      ntbCount,
      runningTotal: total,
      avgSubs,
    };
  }, [trades]);

  const filteredTrades = useMemo(() => {
    let result = trades;
    if (filter === 'fu')
      result = result.filter((t) =>
        t.subs.some(
          (s) => s.status === 'fu1' || s.status === 'fu2' || s.status === 'fu3',
        ),
      );
    else if (filter !== 'all')
      result = result.filter((t) => t.subs.some((s) => s.status === filter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.trade.toLowerCase().includes(q) ||
          t.subs.some((s) => s.name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [trades, filter, search]);

  const chipCounts = useMemo<Record<FilterKey, number>>(() => {
    return {
      all: trades.length,
      snt: trades.filter((t) => t.subs.some((s) => s.status === 'snt')).length,
      rec: trades.filter((t) => t.subs.some((s) => s.status === 'rec')).length,
      hld: trades.filter((t) => t.subs.some((s) => s.status === 'hld')).length,
      fnl: trades.filter((t) => t.subs.some((s) => s.status === 'fnl')).length,
      fu: trades.filter((t) =>
        t.subs.some(
          (s) => s.status === 'fu1' || s.status === 'fu2' || s.status === 'fu3',
        ),
      ).length,
      ntb: trades.filter(
        (t) => t.subs.length > 0 && t.subs.every((s) => s.status === 'ntb'),
      ).length,
      fu1: 0,
      fu2: 0,
      fu3: 0,
    };
  }, [trades]);

  const runningLowTotal = useMemo(
    () => trades.reduce((a, t) => a + (t.low ?? 0), 0),
    [trades],
  );

  return (
    <>
      {/* Breadcrumb */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            color: 'var(--color-text-info)',
            cursor: 'pointer',
            fontSize: 12,
            border: 'none',
            background: 'transparent',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          Portfolio
        </button>
        <i className="ti ti-chevron-right" style={{ fontSize: 12, opacity: 0.5 }} />
        <strong style={{ color: 'var(--color-text-primary)' }}>
          800 Brady Ave · Bidding
        </strong>
      </div>

      {/* Project header */}
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '14px 18px',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            <i
              className="ti ti-map-pin"
              style={{ fontSize: 13, marginRight: 4, opacity: 0.6 }}
            />
            {project.location}
            <span style={{ margin: '0 8px', opacity: 0.3 }}>·</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
              }}
            >
              {project.id}
            </span>
          </div>
        </div>
        {/* Coord chip */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px 3px 4px',
            borderRadius: 999,
            background: 'var(--c-malky-bg)',
            color: 'var(--c-malky-dark)',
            fontSize: 11,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--c-malky)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {project.coordInitials}
          </span>
          {project.coordName}
        </span>
        {/* Phase badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--bid-rec-bg)',
            color: 'var(--bid-rec-fg)',
            border: `1px solid var(--bid-rec-ring)`,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <i className="ti ti-gavel" style={{ fontSize: 12 }} />
          {project.phase}
        </span>
      </div>

      {/* 7 KPIs */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          marginBottom: '1.25rem',
        }}
      >
        <KpiCard
          label="Total trades"
          caption="in scope"
          value={kpis.total}
          icon="ti-list"
          tone="info"
        />
        <KpiCard
          label="Finalized"
          caption="locked in"
          value={kpis.fnlCount}
          icon="ti-trophy"
          tone="good"
        />
        <KpiCard
          label="Out for bid"
          caption="snt + rec"
          value={kpis.outCount}
          icon="ti-send"
          tone="info"
        />
        <KpiCard
          label="On hold"
          caption="needs review"
          value={kpis.hldCount}
          icon="ti-hand-stop"
          tone="danger"
        />
        <KpiCard
          label="Not bidding"
          caption="declined"
          value={kpis.ntbCount}
          icon="ti-ban"
          tone="amber"
        />
        <KpiCard
          label="Lowest running"
          caption="sum of low bids"
          value={fmt$(runningLowTotal)}
          icon="ti-cash"
          tone="good"
        />
        <KpiCard
          label="Avg subs / trade"
          caption="depth of coverage"
          value={kpis.avgSubs}
          icon="ti-users"
          tone="info"
        />
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        {FILTER_CHIPS.map((chip) => {
          const isActive = chip.key === filter;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 999,
                border: isActive
                  ? '0.5px solid var(--lib-softblack)'
                  : '0.5px solid var(--color-border-tertiary)',
                background: isActive ? 'var(--lib-softblack)' : 'var(--color-background-primary)',
                color: isActive ? '#fff' : 'var(--color-text-secondary)',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {chip.label}
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: isActive ? 'rgba(255,255,255,0.18)' : 'var(--color-background-secondary)',
                  color: isActive ? '#fff' : 'var(--color-text-tertiary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {chipCounts[chip.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bidding table */}
      <SectionCard title="Bid breakdown by trade" icon="ti-gavel">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <colgroup>
              <col style={{ width: 240 }} />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col style={{ width: 140 }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 600,
                    background: 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                  }}
                >
                  Trade
                  <span
                    style={{
                      display: 'block',
                      fontSize: 9,
                      fontWeight: 400,
                      textTransform: 'none',
                      letterSpacing: 0,
                      color: 'var(--color-text-tertiary)',
                      opacity: 0.7,
                      marginTop: 1,
                    }}
                  >
                    canonical · from ClickUp
                  </span>
                </th>
                {['SUB 1', 'SUB 2', 'SUB 3', 'SUB 4', 'SUB 5', 'Lowest Bid'].map(
                  (h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: i === 5 ? 'right' : 'center',
                        padding: '8px 10px',
                        fontSize: 10,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 600,
                        background: 'var(--color-background-secondary)',
                        border: '0.5px solid var(--color-border-tertiary)',
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade, ti) => {
                const subs5: (BidSub | null)[] = Array.from({ length: 5 }, (_, i) => trade.subs[i] ?? null);
                const isZebra = ti % 2 === 1;
                const lowestZebraColor = isZebra
                  ? 'rgba(220,234,247,1)'
                  : 'rgba(252,235,217,1)';
                return (
                  <tr key={ti}>
                    {/* Trade name */}
                    <td
                      style={{
                        padding: '8px 10px',
                        border: '0.5px solid var(--color-border-tertiary)',
                        verticalAlign: 'middle',
                        background: 'var(--color-background-primary)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setDrawer({ type: 'trade', trade })}
                    >
                      <div style={{ fontWeight: 500, fontSize: 12.5 }}>{trade.trade}</div>
                      {trade.annot && (
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--danger-fg)',
                            marginTop: 2,
                            fontStyle: 'italic',
                          }}
                        >
                          {trade.annot}
                        </div>
                      )}
                      <div
                        style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}
                      >
                        {trade.subs.length} sub{trade.subs.length !== 1 ? 's' : ''}
                      </div>
                    </td>

                    {/* Sub cells */}
                    {subs5.map((sub, si) => {
                      if (!sub) {
                        return (
                          <td
                            key={si}
                            style={{
                              padding: '6px 8px',
                              border: '0.5px solid var(--color-border-tertiary)',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                            }}
                          >
                            <div
                              style={{
                                border: '1px dashed var(--color-border-tertiary)',
                                borderRadius: 5,
                                padding: '4px 6px',
                                fontSize: 10,
                                color: 'var(--color-text-tertiary)',
                                minHeight: 26,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              —
                            </div>
                          </td>
                        );
                      }
                      const m = STATUS_META[sub.status];
                      const isLow = sub.amount !== null && sub.amount === trade.low;
                      return (
                        <td
                          key={si}
                          style={{
                            padding: '4px 6px',
                            border: '0.5px solid var(--color-border-tertiary)',
                            verticalAlign: 'top',
                            cursor: 'pointer',
                          }}
                          onClick={() => setDrawer({ type: 'sub', trade, sub })}
                        >
                          {/* name block */}
                          <div
                            style={{
                              display: 'block',
                              padding: '5px 8px',
                              borderRadius: '5px 5px 0 0',
                              border: `1px solid ${m.ring}`,
                              borderBottom: 'none',
                              fontSize: 11.5,
                              textAlign: 'center',
                              fontWeight: 500,
                              minHeight: 26,
                              background: m.bg,
                              color: m.fg,
                            }}
                          >
                            {sub.name}
                          </div>
                          {/* amount block */}
                          <div
                            style={{
                              display: 'block',
                              padding: '5px 8px',
                              border: `1px solid var(--color-border-tertiary)`,
                              borderTop: 'none',
                              borderRadius: '0 0 5px 5px',
                              fontSize: 11.5,
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              minHeight: 26,
                              background: isLow ? 'var(--good-bg)' : 'transparent',
                              color: isLow ? 'var(--good-fg)' : 'var(--color-text-secondary)',
                              fontWeight: isLow ? 600 : 400,
                            }}
                          >
                            {sub.amount !== null ? fmt$(sub.amount) : '—'}
                          </div>
                        </td>
                      );
                    })}

                    {/* Lowest bid cell */}
                    <td
                      style={{
                        padding: '8px 10px',
                        border: '0.5px solid var(--color-border-tertiary)',
                        textAlign: 'right',
                        verticalAlign: 'middle',
                        background: lowestZebraColor,
                        fontVariantNumeric: 'tabular-nums',
                        color:
                          trade.low !== null ? 'var(--good-fg)' : 'var(--color-text-tertiary)',
                        fontWeight: trade.low !== null ? 600 : 400,
                        fontSize: 12,
                      }}
                    >
                      {fmt$(trade.low)}
                    </td>
                  </tr>
                );
              })}

              {/* Footer totals row */}
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '10px 12px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    fontWeight: 600,
                    fontSize: 12,
                    background: 'var(--color-background-secondary)',
                    color: 'var(--color-text-secondary)',
                    textAlign: 'right',
                  }}
                >
                  Total · lowest column · running
                </td>
                <td
                  style={{
                    padding: '10px 12px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    fontWeight: 700,
                    fontSize: 13,
                    textAlign: 'right',
                    background: 'var(--good-bg)',
                    color: 'var(--good-fg)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt$(runningLowTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {drawer && <Drawer payload={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

// ─── Matrix heatmap view ──────────────────────────────────────────────────────

function MatrixView({
  onBack,
  onGoDetailed,
  search = '',
}: {
  onBack: () => void;
  onGoDetailed: () => void;
  search?: string;
}) {
  const { project, portfolioProjects } = useBidding();
  const trades = useMemo(() => {
    if (!search.trim()) return project.trades;
    const q = search.toLowerCase();
    return project.trades.filter(
      (t) =>
        t.trade.toLowerCase().includes(q) ||
        t.subs.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [project.trades, search]);
  const cols = portfolioProjects.slice(0, 8);

  return (
    <SectionCard
      title="Trade × project coverage matrix"
      icon="ti-layout-grid"
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
            Overview
          </button>
          <button
            type="button"
            onClick={onGoDetailed}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Detailed
            <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
          </button>
        </div>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-tertiary)',
                  fontWeight: 600,
                  background: 'var(--color-background-secondary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  minWidth: 200,
                }}
              >
                Trade
              </th>
              {cols.map((proj, pi) => (
                <th
                  key={pi}
                  style={{
                    textAlign: 'center',
                    padding: '6px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    background: proj.isReal
                      ? 'var(--color-background-secondary)'
                      : 'var(--color-background-tertiary, var(--color-background-secondary))',
                    border: '0.5px solid var(--color-border-tertiary)',
                    minWidth: 90,
                    color: proj.isReal ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {proj.isReal && (
                      <span style={{ color: 'var(--lib-orange)', marginRight: 2 }}>★</span>
                    )}
                    {proj.name.split(' ').slice(0, 2).join(' ')}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 400,
                      color: 'var(--color-text-tertiary)',
                      marginTop: 1,
                    }}
                  >
                    {proj.location.split(',')[0]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, ti) => {
              const ts = tradeStatus(trade);
              const isEven = ti % 2 === 0;
              return (
                <tr key={ti}>
                  <td
                    style={{
                      padding: '7px 12px',
                      border: '0.5px solid var(--color-border-tertiary)',
                      fontWeight: 500,
                      fontSize: 11.5,
                      background: isEven
                        ? 'var(--color-background-primary)'
                        : 'var(--color-background-secondary)',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                    }}
                  >
                    {trade.trade}
                    {trade.annot && (
                      <div style={{ fontSize: 9, color: 'var(--danger-fg)', fontStyle: 'italic', marginTop: 1 }}>
                        {trade.annot}
                      </div>
                    )}
                  </td>
                  {cols.map((proj, pi) => {
                    if (!proj.isReal) {
                      return (
                        <td
                          key={pi}
                          style={{
                            padding: '6px 8px',
                            border: '0.5px solid var(--color-border-tertiary)',
                            textAlign: 'center',
                            color: 'var(--color-text-tertiary)',
                            fontSize: 10,
                            fontStyle: 'italic',
                            background: isEven
                              ? 'var(--color-background-primary)'
                              : 'var(--color-background-secondary)',
                          }}
                        >
                          pending
                        </td>
                      );
                    }
                    const m = ts ? STATUS_META[ts] : null;
                    return (
                      <td
                        key={pi}
                        style={{
                          padding: '4px 6px',
                          border: '0.5px solid var(--color-border-tertiary)',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}
                      >
                        {m ? (
                          <div
                            style={{
                              background: m.bg,
                              color: m.fg,
                              border: `1px solid ${m.ring}`,
                              borderRadius: 4,
                              padding: '2px 5px',
                              fontSize: 9,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.label.split(' ')[0]}
                            {trade.low !== null && (
                              <div style={{ fontSize: 8, fontWeight: 400, color: m.fg, opacity: 0.8 }}>
                                {fmt$(trade.low)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Status legend */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 14,
          fontSize: 11,
          color: 'var(--color-text-secondary)',
        }}
      >
        {(Object.keys(STATUS_META) as BidStatus[]).map((st) => {
          const m = STATUS_META[st];
          return (
            <span key={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: m.bg,
                  border: `1px solid ${m.ring}`,
                }}
              />
              {m.label}
            </span>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Pipeline view (kanban) ───────────────────────────────────────────────────

function PipelineView({ search = '' }: { search?: string }) {
  const { project } = useBidding();
  const trades = useMemo(() => {
    if (!search.trim()) return project.trades;
    const q = search.toLowerCase();
    return project.trades.filter(
      (t) =>
        t.trade.toLowerCase().includes(q) ||
        t.subs.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [project.trades, search]);

  const columns: { key: BidStatus; label: string; items: BidTrade[] }[] = [
    {
      key: 'snt',
      label: 'Sent',
      items: trades.filter(
        (t) =>
          t.subs.some((s) => s.status === 'snt') &&
          !t.subs.some((s) => s.status === 'rec' || s.status === 'fnl'),
      ),
    },
    {
      key: 'rec',
      label: 'Received',
      items: trades.filter(
        (t) =>
          t.subs.some((s) => s.status === 'rec') && !t.subs.some((s) => s.status === 'fnl'),
      ),
    },
    {
      key: 'fu1',
      label: 'Follow-up',
      items: trades.filter((t) =>
        t.subs.some((s) => s.status === 'fu1' || s.status === 'fu2' || s.status === 'fu3'),
      ),
    },
    {
      key: 'hld',
      label: 'Hold',
      items: trades.filter((t) => t.subs.some((s) => s.status === 'hld')),
    },
    {
      key: 'fnl',
      label: 'Finalized',
      items: trades.filter((t) => t.subs.some((s) => s.status === 'fnl')),
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 10,
        marginBottom: '1.25rem',
      }}
    >
      {columns.map((col) => {
        const m = STATUS_META[col.key];
        return (
          <div
            key={col.key}
            style={{
              background: 'var(--color-background-secondary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '10px 10px 14px',
              minHeight: 120,
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
                paddingBottom: 8,
                borderBottom: `2px solid ${m.ring}`,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: m.strong,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {col.label}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-text-tertiary)',
                  background: 'var(--color-background-primary)',
                  borderRadius: 999,
                  padding: '1px 6px',
                }}
              >
                {col.items.length}
              </span>
            </div>
            {/* Cards */}
            {col.items.map((trade, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--color-background-primary)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  marginBottom: 6,
                  border: `0.5px solid ${m.ring}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500 }}>{trade.trade}</div>
                {trade.low !== null && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--good-fg)',
                      marginTop: 2,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt$(trade.low)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    marginTop: 2,
                  }}
                >
                  {trade.subs.length} sub{trade.subs.length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
            {col.items.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-tertiary)',
                  textAlign: 'center',
                  padding: '16px 0',
                  fontStyle: 'italic',
                }}
              >
                none
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Follow-ups view ──────────────────────────────────────────────────────────

function FollowUpsView({ search = '' }: { search?: string }) {
  const { project } = useBidding();

  const filteredTrades = useMemo(() => {
    if (!search.trim()) return project.trades;
    const q = search.toLowerCase();
    return project.trades.filter(
      (t) =>
        t.trade.toLowerCase().includes(q) ||
        t.subs.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [project.trades, search]);

  const bands: {
    key: 'fu1' | 'fu2' | 'fu3';
    label: string;
    sub: string;
    fg: string;
    bg: string;
    ring: string;
  }[] = [
    {
      key: 'fu1',
      label: 'Overdue',
      sub: '14+ days ago',
      fg: 'var(--danger-fg)',
      bg: 'var(--danger-bg)',
      ring: 'var(--danger-ring, var(--bid-fu1-ring))',
    },
    {
      key: 'fu2',
      label: 'Due soon',
      sub: '~7 days ago',
      fg: 'var(--warn-fg)',
      bg: 'var(--warn-bg)',
      ring: 'var(--warn-ring, var(--bid-fu2-ring))',
    },
    {
      key: 'fu3',
      label: 'Fresh',
      sub: 'just sent',
      fg: 'var(--good-fg)',
      bg: 'var(--good-bg)',
      ring: 'var(--good-ring, var(--bid-fu3-ring))',
    },
  ];

  const hasSomething = bands.some((b) =>
    filteredTrades.some((t) => t.subs.some((s) => s.status === b.key)),
  );

  if (!hasSomething) {
    return (
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '32px',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          marginBottom: '1.25rem',
        }}
      >
        No active follow-ups — great job!
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {bands.map((band) => {
        const tradesInBand = filteredTrades.filter((t) =>
          t.subs.some((s) => s.status === band.key),
        );
        if (tradesInBand.length === 0) return null;
        return (
          <div key={band.key}>
          <SectionCard
            title={`${band.label} · ${band.sub}`}
            icon="ti-message-2"
          >
            {tradesInBand.map((trade, i) => {
              const fuSubs = trade.subs.filter((s) => s.status === band.key);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom:
                      i < tradesInBand.length - 1
                        ? '0.5px solid var(--color-border-tertiary)'
                        : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      alignSelf: 'stretch',
                      borderRadius: 2,
                      background: band.fg,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{trade.trade}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-secondary)',
                        marginTop: 2,
                      }}
                    >
                      {fuSubs.map((s) => s.name).join(' · ')}
                    </div>
                  </div>
                  <span
                    style={{
                      background: band.bg,
                      color: band.fg,
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_META[band.key].label}
                  </span>
                  <button
                    type="button"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--border-radius-md)',
                      border: '0.5px solid var(--color-border-secondary)',
                      background: 'var(--color-background-secondary)',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <i className="ti ti-send" style={{ fontSize: 11 }} />
                    Send FU
                  </button>
                </div>
              );
            })}
          </SectionCard>
          </div>
        );
      })}
    </div>
  );
}

// ─── Spreads view ─────────────────────────────────────────────────────────────

function SpreadsView({ search = '' }: { search?: string }) {
  const { project } = useBidding();

  const sourceTrades = useMemo(() => {
    if (!search.trim()) return project.trades;
    const q = search.toLowerCase();
    return project.trades.filter(
      (t) =>
        t.trade.toLowerCase().includes(q) ||
        t.subs.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [project.trades, search]);

  const tradesWithBids = sourceTrades
    .map((t) => {
      const amounts = t.subs
        .map((s) => s.amount)
        .filter((a): a is number => a !== null);
      return { trade: t, amounts };
    })
    .filter((x) => x.amounts.length >= 2);

  const allAmounts = tradesWithBids.flatMap((x) => x.amounts);
  const globalMax = allAmounts.length > 0 ? Math.max(...allAmounts) : 1;

  return (
    <SectionCard title="Bid spreads by trade" icon="ti-chart-bar">
      {tradesWithBids.length === 0 ? (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13, textAlign: 'center', padding: 24 }}>
          No trades with multiple bids yet.
        </div>
      ) : (
        tradesWithBids.map(({ trade, amounts }: { trade: BidTrade; amounts: number[] }, i: number) => {
          const min = Math.min(...amounts);
          const max = Math.max(...amounts);
          const spread = max > 0 ? Math.round(((max - min) / min) * 100) : 0;
          const leftPct = (min / globalMax) * 100;
          const rightPct = (max / globalMax) * 100;
          const isHighSpread = spread > 30;
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    width: 220,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {trade.trade}
                </span>
                <div
                  style={{
                    flex: 1,
                    position: 'relative',
                    height: 16,
                    background: 'var(--color-background-secondary)',
                    borderRadius: 3,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${rightPct - leftPct}%`,
                      top: 0,
                      bottom: 0,
                      background: isHighSpread ? 'var(--bid-fu1-bg)' : 'var(--bid-rec-bg)',
                      border: `1px solid ${isHighSpread ? 'var(--bid-fu1-ring)' : 'var(--bid-rec-ring)'}`,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 80,
                    textAlign: 'right',
                    flexShrink: 0,
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span style={{ color: 'var(--good-fg)', fontWeight: 500 }}>{fmt$(min)}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', margin: '0 3px' }}>–</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{fmt$(max)}</span>
                </div>
                <div
                  style={{
                    width: 42,
                    textAlign: 'right',
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    color: isHighSpread ? 'var(--danger-fg)' : 'var(--color-text-secondary)',
                  }}
                >
                  {spread}%
                </div>
              </div>
            </div>
          );
        })
      )}
      <div
        style={{
          fontSize: 10,
          color: 'var(--color-text-tertiary)',
          marginTop: 6,
          display: 'flex',
          gap: 16,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              background: 'var(--bid-rec-bg)',
              border: '1px solid var(--bid-rec-ring)',
            }}
          />
          Normal spread
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              background: 'var(--bid-fu1-bg)',
              border: '1px solid var(--bid-fu1-ring)',
            }}
          />
          High spread (&gt;30%)
        </span>
      </div>
    </SectionCard>
  );
}

// ─── Subs leaderboard view ────────────────────────────────────────────────────

function SubsView({ search = '' }: { search?: string }) {
  const { project } = useBidding();

  const subMap = new Map<
    string,
    { name: string; count: number; totalAmount: number; statuses: Set<BidStatus>; trades: string[] }
  >();

  project.trades.forEach((trade) => {
    trade.subs.forEach((sub) => {
      if (!subMap.has(sub.name)) {
        subMap.set(sub.name, {
          name: sub.name,
          count: 0,
          totalAmount: 0,
          statuses: new Set(),
          trades: [],
        });
      }
      const entry = subMap.get(sub.name)!;
      entry.count++;
      if (sub.amount !== null) entry.totalAmount += sub.amount;
      entry.statuses.add(sub.status);
      entry.trades.push(trade.trade);
    });
  });

  const ranked = Array.from(subMap.values())
    .filter((s) => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) => b.count - a.count || b.totalAmount - a.totalAmount,
    );

  return (
    <SectionCard title="Subcontractor leaderboard" icon="ti-users">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['#', 'Sub name', 'Trades', 'Total bid', 'Statuses'].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: i === 0 || i === 2 || i === 3 ? 'center' : 'left',
                    padding: '8px 10px',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                    fontWeight: 600,
                    background: 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((sub, i) => (
              <tr key={sub.name}>
                <td
                  style={{
                    padding: '8px 10px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    textAlign: 'center',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    fontWeight: 500,
                  }}
                >
                  {sub.name}
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--color-text-tertiary)',
                      marginTop: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 260,
                    }}
                  >
                    {sub.trades.join(', ')}
                  </div>
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {sub.count}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color:
                      sub.totalAmount > 0 ? 'var(--good-fg)' : 'var(--color-text-tertiary)',
                    fontWeight: sub.totalAmount > 0 ? 600 : 400,
                  }}
                >
                  {sub.totalAmount > 0 ? fmtLong$(sub.totalAmount) : '—'}
                </td>
                <td
                  style={{
                    padding: '6px 10px',
                    border: '0.5px solid var(--color-border-tertiary)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Array.from(sub.statuses).map((s) => (
                      <span key={s}><StatusPill status={s} small /></span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Main BiddingDashboard ─────────────────────────────────────────────────────

type View = 'overview' | 'detailed' | 'matrix' | 'pipeline' | 'followups' | 'spreads' | 'subs';

const VIEW_TABS: { id: View; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',   icon: 'ti-layout-dashboard' },
  { id: 'detailed',  label: 'Detailed',   icon: 'ti-table-options' },
  { id: 'matrix',    label: 'Matrix',     icon: 'ti-layout-grid' },
  { id: 'pipeline',  label: 'Pipeline',   icon: 'ti-git-branch' },
  { id: 'followups', label: 'Follow-ups', icon: 'ti-message-2' },
  { id: 'spreads',   label: 'Spreads',    icon: 'ti-chart-bar' },
  { id: 'subs',      label: 'Subs',       icon: 'ti-users' },
];

export function BiddingDashboard() {
  const [view, setView] = useState<View>('overview');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [search, setSearch] = useState('');

  // SWR URL includes projectId once the user (or the first-load effect) has picked a project.
  // Changing selectedProject changes the key, which triggers a re-fetch.
  const swrUrl = selectedProject
    ? `/api/bidding?projectId=${encodeURIComponent(selectedProject)}`
    : '/api/bidding';

  const { data, isLoading } = useSWR<BiddingPayload>(swrUrl, fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  // When the initial (no-param) fetch returns, lock in the first real project so subsequent
  // project-picker changes produce a stable URL key change rather than replacing stale data.
  useEffect(() => {
    if (data && !selectedProject) {
      const first = data.portfolioProjects.find(p => p.isReal) ?? data.portfolioProjects[0];
      if (first) setSelectedProject(first.name);
    }
  }, [data, selectedProject]);

  const subtitle = useMemo(() => {
    if (!data) return 'Loading…';
    const { project, portfolioProjects } = data;
    const fnlCount = project.trades.filter(t => t.subs.some(s => s.status === 'fnl')).length;
    return `${project.trades.length} trades · ${fnlCount} finalized · ${portfolioProjects.length} projects in portfolio`;
  }, [data]);

  if (isLoading || !data) {
    return (
      <>
        <LogoHeader title="Bidding Dashboard" subtitleOverride="Loading from ClickUp…" syncedAt={null} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          <i className="ti ti-loader" style={{ fontSize: 20, marginRight: 8, animation: 'lib-spin 1s linear infinite' }} />
          Loading bidding data…
        </div>
      </>
    );
  }

  if (data.warning) {
    return (
      <>
        <LogoHeader title="Bidding Dashboard" subtitleOverride={data.warning} syncedAt={null} />
        <div style={{ padding: '32px 24px', color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          <strong>No data available.</strong> {data.warning}
        </div>
      </>
    );
  }

  const { portfolioProjects } = data;

  return (
    <BiddingCtx.Provider value={data}>
      <LogoHeader
        title="Bidding Dashboard"
        subtitleOverride={subtitle}
        syncedAt={data.syncedAt || null}
      />

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
        className="filter-bar"
      >
        {/* Search */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <i
            className="ti ti-search"
            style={{
              position: 'absolute',
              left: 8,
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            placeholder="Search trades, subs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              height: 32,
              paddingLeft: 26,
              paddingRight: 8,
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 12.5,
              fontFamily: 'inherit',
              width: 200,
              outline: 'none',
            }}
          />
        </div>

        {/* Project picker */}
        <select
          value={selectedProject}
          onChange={(e) => {
            setSelectedProject(e.target.value);
            const proj = portfolioProjects.find((p) => p.name === e.target.value);
            if (proj?.isReal) setView('detailed');
          }}
          style={{
            height: 32,
            padding: '0 10px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            fontSize: 12.5,
            fontFamily: 'inherit',
            minWidth: 200,
          }}
        >
          {portfolioProjects.map((p) => (
            <option key={p.name} value={p.name}>
              {p.isReal ? '★ ' : ''}
              {p.name}{p.location ? ` · ${p.location}` : ''}
            </option>
          ))}
        </select>

        {/* View tab strip */}
        <div
          className="view-toggle"
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            marginLeft: 'auto',
          }}
        >
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab${view === tab.id ? ' active' : ''}`}
              onClick={() => setView(tab.id)}
            >
              <i className={`ti ${tab.icon}`} style={{ fontSize: 13, marginRight: 5 }} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      {view === 'overview' && <OverviewView onGoDetailed={() => setView('detailed')} />}
      {view === 'detailed' && <DetailedView onBack={() => setView('overview')} search={search} />}
      {view === 'matrix' && (
        <MatrixView
          onBack={() => setView('overview')}
          onGoDetailed={() => setView('detailed')}
          search={search}
        />
      )}
      {view === 'pipeline' && <PipelineView search={search} />}
      {view === 'followups' && <FollowUpsView search={search} />}
      {view === 'spreads' && <SpreadsView search={search} />}
      {view === 'subs' && <SubsView search={search} />}

      {/* Footer — two lines */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          paddingBottom: 12,
          lineHeight: 1.7,
        }}
      >
        <div>
          Live from ClickUp · 60-second cache · click any project, trade row, or sub cell to open in ClickUp
        </div>
        <div>
          Color = bidding status from the 8-color PDF palette · variance bar = New − Estimated · &quot;Manual&quot; = auto-rule overridden
        </div>
      </div>
    </BiddingCtx.Provider>
  );
}
