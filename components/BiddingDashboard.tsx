'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { LogoHeader } from './LogoHeader';
import { ProjectPicker } from './ProjectPicker';
import type { BidStatus, BidSub, BidTrade, BiddingPayload, BiddingPortfolioPayload, BiddingProject } from '@/lib/bidding-types';
import { taskUrl, folderUrl } from '@/lib/urls';
import { SITE_URL } from '@/lib/constants';
import { EmbedSyncBar } from './EmbedSyncBar';

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

async function portfolioFetcher(url: string): Promise<BiddingPortfolioPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json() as Promise<BiddingPortfolioPayload>;
}

function useBiddingPortfolio() {
  const { data } = useSWR<BiddingPortfolioPayload>(
    '/api/bidding/portfolio',
    portfolioFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  return data ?? null;
}

// ─── Status metadata ──────────────────────────────────────────────────────────

type StatusMeta = {
  label: string;
  /** Compact label for tight surfaces like the portfolio matrix cell. */
  short: string;
  icon: string;
  bg: string;
  fg: string;
  ring: string;
  strong: string;
};

const STATUS_META: Record<BidStatus, StatusMeta> = {
  ntb: { label: 'To Send',       short: 'To Send',     icon: 'ti-ban',        bg: 'var(--bid-ntb-bg)', fg: 'var(--bid-ntb-fg)', ring: 'var(--bid-ntb-ring)', strong: 'var(--bid-ntb-strong)' },
  snt: { label: 'RFP Sent',      short: 'RFP Sent',    icon: 'ti-send',       bg: 'var(--bid-snt-bg)', fg: 'var(--bid-snt-fg)', ring: 'var(--bid-snt-ring)', strong: 'var(--bid-snt-strong)' },
  wfp: { label: 'Waiting for Plans', short: 'Waiting', icon: 'ti-clock-pause', bg: 'var(--bid-wfp-bg)', fg: 'var(--bid-wfp-fg)', ring: 'var(--bid-wfp-ring)', strong: 'var(--bid-wfp-strong)' },
  rec: { label: 'Bid Received',  short: 'Received',    icon: 'ti-checks',     bg: 'var(--bid-rec-bg)', fg: 'var(--bid-rec-fg)', ring: 'var(--bid-rec-ring)', strong: 'var(--bid-rec-strong)' },
  lvl: { label: 'Leveling',      short: 'Leveling',    icon: 'ti-scale',      bg: 'var(--bid-lvl-bg)', fg: 'var(--bid-lvl-fg)', ring: 'var(--bid-lvl-ring)', strong: 'var(--bid-lvl-strong)' },
  lvp: { label: 'Leveled · Pending Review', short: 'Leveled', icon: 'ti-list-check', bg: 'var(--bid-lvp-bg)', fg: 'var(--bid-lvp-fg)', ring: 'var(--bid-lvp-ring)', strong: 'var(--bid-lvp-strong)' },
  reb: { label: 'Needs Rebid',   short: 'Rebid',      icon: 'ti-refresh',    bg: 'var(--bid-reb-bg)', fg: 'var(--bid-reb-fg)', ring: 'var(--bid-reb-ring)', strong: 'var(--bid-reb-strong)' },
  hld: { label: 'No Bid / Declined', short: 'No Bid',  icon: 'ti-hand-stop', bg: 'var(--bid-hld-bg)', fg: 'var(--bid-hld-fg)', ring: 'var(--bid-hld-ring)', strong: 'var(--bid-hld-strong)' },
  fnl: { label: 'Awarded',       short: 'Awarded',     icon: 'ti-trophy',     bg: 'var(--bid-fnl-bg)', fg: 'var(--bid-fnl-fg)', ring: 'var(--bid-fnl-ring)', strong: 'var(--bid-fnl-strong)' },
  fu1: { label: 'Followed Up · W1 (14d ago)', short: 'Followed Up', icon: 'ti-message-2', bg: 'var(--bid-fu1-bg)', fg: 'var(--bid-fu1-fg)', ring: 'var(--bid-fu1-ring)', strong: 'var(--bid-fu1-strong)' },
  fu2: { label: 'Followed Up · W2 (7d ago)',  short: 'Followed Up', icon: 'ti-message-2', bg: 'var(--bid-fu2-bg)', fg: 'var(--bid-fu2-fg)', ring: 'var(--bid-fu2-ring)', strong: 'var(--bid-fu2-strong)' },
  fu3: { label: 'Followed Up · W3 (0d ago)',  short: 'Followed Up', icon: 'ti-message-2', bg: 'var(--bid-fu3-bg)', fg: 'var(--bid-fu3-fg)', ring: 'var(--bid-fu3-ring)', strong: 'var(--bid-fu3-strong)' },
};

// Lifecycle rank (low → high). Used to pick the *most advanced* status among a
// trade's bids for the matrix cell. NO BID / DECLINED sits just above "not
// started" so it only surfaces when nothing more advanced exists for the trade.
const STATUS_RANK: Record<BidStatus, number> = {
  ntb: 0,
  hld: 1,
  // "needs rebid" is an attention state, not an advanced one — rank it low so a
  // trade's cell still surfaces its most-advanced *valid* bid when one exists.
  reb: 1,
  wfp: 2,
  snt: 3,
  fu1: 4,
  fu2: 4,
  fu3: 4,
  rec: 5,
  lvl: 6,
  lvp: 7,
  fnl: 8,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (n === null) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtLong$(n: number): string {
  return `$${n.toLocaleString()}`;
}

/**
 * Trade-level status = the *most advanced* status among the trade's bids, per
 * STATUS_RANK. This replaces the old binary collapse where every non-received
 * status fell back to "To Send". Follow-up sub-tiers (fu1/fu2/fu3) share a rank
 * and collapse to `fu1` so the cell renders a single "Followed Up" pill.
 */
function tradeStatus(trade: BidTrade): BidStatus | null {
  if (!trade.subs.length) return null;
  let best: BidStatus | null = null;
  let bestRank = -Infinity;
  for (const sub of trade.subs) {
    const rank = STATUS_RANK[sub.status];
    if (rank > bestRank) {
      bestRank = rank;
      best = sub.status;
    }
  }
  if (best === 'fu2' || best === 'fu3') return 'fu1';
  return best;
}

/**
 * Live ClickUp color that drove a trade's cell status — the color of the
 * highest-ranked sub, mirroring `tradeStatus`. Returns null when ClickUp
 * reported no color (the pill then falls back to the app palette).
 */
function tradeStatusColor(trade: BidTrade): string | null {
  if (!trade.subs.length) return null;
  let best: BidSub | null = null;
  let bestRank = -Infinity;
  for (const sub of trade.subs) {
    const rank = STATUS_RANK[sub.status];
    if (rank > bestRank) {
      bestRank = rank;
      best = sub;
    }
  }
  return best?.color ?? null;
}

/** ClickUp deep-link for a trade cell: the trade task if we have it, else the first sub's task. */
function tradeClickUpUrl(trade: BidTrade): string | null {
  if (trade.taskId) return taskUrl(trade.taskId);
  return trade.subs.find((s) => s.url)?.url ?? null;
}

/** Convert a ClickUp hex color (#rgb / #rrggbb) to an rgba() string; pass other formats through. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

// When `color` (a live ClickUp status color) is supplied the pill's tint, border
// and dot are derived from it so the dashboard matches ClickUp exactly; the label
// text stays on the app's readable foreground. Without it the pill uses the app
// palette, so every existing caller is unaffected.
function StatusPill({ status, small, color }: { status: BidStatus; small?: boolean; color?: string | null }) {
  const m = STATUS_META[status];
  const hasLive = !!color;
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
        border: `1px solid ${hasLive ? hexToRgba(color!, 0.55) : m.ring}`,
        background: hasLive ? hexToRgba(color!, 0.16) : m.bg,
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
          background: hasLive ? color! : m.strong,
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
  onClick,
  active,
}: {
  label: string;
  caption: string;
  value: string | number;
  icon: string;
  tone: KpiTone;
  onClick?: () => void;
  active?: boolean;
}) {
  const ts = TONE_STYLES[tone];
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'var(--color-background-secondary)' : 'var(--color-background-secondary)',
        border: active ? '1.5px solid var(--lib-softblack)' : '0.5px solid transparent',
        borderRadius: 'var(--border-radius-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: active ? '0 0 0 3px rgba(0,0,0,0.06)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-secondary)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</div>
        <div
          className="kpi-value"
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
        className="kpi-icon"
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
    (s) => s.amount === lowestAmount && lowestAmount !== null && s.status !== 'reb',
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
              {payload.sub.url && (
                <div>
                  <div
                    style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}
                  >
                    OPEN IN CLICKUP
                  </div>
                  <a
                    href={payload.sub.url}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    Open task in ClickUp
                  </a>
                </div>
              )}
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
                    const isLow = sub.amount !== null && sub.amount === lowestAmount && sub.status !== 'reb';
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

  const portfolioData = useBiddingPortfolio();

  // Map: projectName → Map<tradeName, BidTrade>
  const projectTradeMap = useMemo(() => {
    const map = new Map<string, Map<string, BidTrade>>();
    if (!portfolioData) return map;
    for (const proj of portfolioData.projects) {
      const tm = new Map<string, BidTrade>();
      for (const t of proj.trades) tm.set(t.trade, t);
      map.set(proj.name, tm);
    }
    return map;
  }, [portfolioData]);

  // Sorted union of all trade names across all portfolio projects
  const allTradeNames = useMemo(() => {
    const names = new Set<string>();
    for (const [, tm] of projectTradeMap) for (const n of tm.keys()) names.add(n);
    return [...names].sort();
  }, [projectTradeMap]);

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
              {portfolioData === null ? (
                <tr>
                  <td colSpan={9} style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                    <i className="ti ti-loader" /> Loading portfolio…
                  </td>
                </tr>
              ) : (
                allTradeNames.map((tradeName, ti) => {
                  // Use the first project's trade to determine sticky-cell highlight
                  const firstProjTrade = portfolioProjects.slice(0, 8).find(p => p.isReal)
                    ? projectTradeMap.get(portfolioProjects.slice(0, 8).find(p => p.isReal)!.name)?.get(tradeName)
                    : undefined;
                  const firstTs = firstProjTrade ? tradeStatus(firstProjTrade) : null;
                  const isHld = firstTs === 'hld';
                  const isFuOrSnt = firstTs === 'fu1' || firstTs === 'snt';
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
                        {tradeName}
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
                        const trade = projectTradeMap.get(proj.name)?.get(tradeName);
                        const ts = trade ? tradeStatus(trade) : null;
                        const lowSub = trade?.subs.find(s => s.amount === trade.low && trade.low !== null && s.status !== 'reb');
                        const cellTaskId = ts ? trade?.taskId : undefined;
                        return (
                          <td
                            key={pi}
                            className={cellTaskId ? 'matrix-task-cell' : undefined}
                            title={cellTaskId ? `Open ${tradeName} · ${proj.name} in ClickUp` : undefined}
                            onClick={cellTaskId ? () => window.open(taskUrl(cellTaskId), '_blank', 'noopener') : undefined}
                            style={{
                              padding: '7px 10px',
                              border: '0.5px solid var(--color-border-tertiary)',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                            }}
                          >
                            {trade === undefined ? (
                              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>—</span>
                            ) : ts ? (
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
                })
              )}
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

type FilterKey = 'all' | BidStatus | 'fu' | 'out' | 'lev';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'snt', label: 'RFP Sent' },
  { key: 'wfp', label: 'Waiting for Plans' },
  { key: 'fu', label: 'Followed Up' },
  { key: 'rec', label: 'Bid Received' },
  { key: 'lev', label: 'Leveling' },
  { key: 'reb', label: 'Needs Rebid' },
  { key: 'fnl', label: 'Awarded' },
  { key: 'hld', label: 'No Bid' },
];

function DetailedView({ onBack, search = '' }: { onBack: () => void; search?: string }) {
  const { project } = useBidding();
  const trades = project.trades;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [drawer, setDrawer] = useState<DrawerPayload | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const kpis = useMemo(() => {
    // Count individual subs (not trades) so the KPI cards reflect sub-level status.
    const allSubs = trades.flatMap((t) => t.subs);
    const fnlCount = allSubs.filter((s) => s.status === 'fnl').length;
    // "In flight" = every actively-in-process bid: sent, waiting for plans,
    // followed up, received, and leveling (everything except To Send / Awarded /
    // No Bid). Previously this only counted snt+rec, hiding leveling & waiting.
    const outCount = allSubs.filter(
      (s) =>
        s.status === 'snt' ||
        s.status === 'wfp' ||
        s.status === 'fu1' ||
        s.status === 'fu2' ||
        s.status === 'fu3' ||
        s.status === 'rec' ||
        s.status === 'lvl' ||
        s.status === 'lvp',
    ).length;
    const levCount = allSubs.filter((s) => s.status === 'lvl' || s.status === 'lvp').length;
    const hldCount = allSubs.filter((s) => s.status === 'hld').length;
    const ntbCount = allSubs.filter((s) => s.status === 'ntb').length;
    const total = trades.reduce((a, t) => a + (t.low ?? 0), 0);
    const avgSubs =
      trades.length
        ? (trades.reduce((a, t) => a + t.subs.length, 0) / trades.length).toFixed(1)
        : '0';
    return {
      totalSubs: allSubs.length,
      totalTrades: trades.length,
      fnlCount,
      outCount,
      levCount,
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
    else if (filter === 'lev')
      result = result.filter((t) =>
        t.subs.some((s) => s.status === 'lvl' || s.status === 'lvp'),
      );
    else if (filter === 'out')
      result = result.filter((t) =>
        t.subs.some(
          (s) =>
            s.status === 'snt' ||
            s.status === 'wfp' ||
            s.status === 'fu1' ||
            s.status === 'fu2' ||
            s.status === 'fu3' ||
            s.status === 'rec' ||
            s.status === 'lvl' ||
            s.status === 'lvp',
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
    // Count individual subs (not trades) so the filter pills reflect sub-level status.
    const allSubs = trades.flatMap((t) => t.subs);
    const inFlight = (s: BidStatus) =>
      s === 'snt' || s === 'wfp' || s === 'fu1' || s === 'fu2' || s === 'fu3' ||
      s === 'rec' || s === 'lvl' || s === 'lvp';
    return {
      all: allSubs.length,
      snt: allSubs.filter((s) => s.status === 'snt').length,
      wfp: allSubs.filter((s) => s.status === 'wfp').length,
      rec: allSubs.filter((s) => s.status === 'rec').length,
      lvl: allSubs.filter((s) => s.status === 'lvl').length,
      lvp: allSubs.filter((s) => s.status === 'lvp').length,
      hld: allSubs.filter((s) => s.status === 'hld').length,
      fnl: allSubs.filter((s) => s.status === 'fnl').length,
      // fu1/fu2/fu3 are all surfaced under the single "Followed Up" pill.
      fu: allSubs.filter((s) => s.status.startsWith('fu')).length,
      lev: allSubs.filter((s) => s.status === 'lvl' || s.status === 'lvp').length,
      ntb: allSubs.filter((s) => s.status === 'ntb').length,
      reb: allSubs.filter((s) => s.status === 'reb').length,
      out: allSubs.filter((s) => inFlight(s.status)).length,
      fu1: 0,
      fu2: 0,
      fu3: 0,
    };
  }, [trades]);

  const runningLowTotal = useMemo(
    () => trades.reduce((a, t) => a + (t.low ?? 0), 0),
    [trades],
  );

  // Status color palette for print (hardcoded hex — CSS vars don't work in popup windows)
  const PRINT_STATUS: Record<BidStatus, { bg: string; fg: string; ring: string; label: string }> = {
    ntb: { bg: '#E8E6E1', fg: '#3F3D38', ring: '#9C9A92', label: 'To Send' },
    snt: { bg: '#7DD3F2', fg: '#053A5F', ring: '#1B7CB0', label: 'RFP Sent' },
    wfp: { bg: '#B7E3D8', fg: '#063A2F', ring: '#2E8C78', label: 'Waiting for Plans' },
    rec: { bg: '#FFE74A', fg: '#3D2D00', ring: '#9C7A00', label: 'Bid Received' },
    lvl: { bg: '#FBD48D', fg: '#4A2C00', ring: '#B87400', label: 'Leveling' },
    lvp: { bg: '#F6B266', fg: '#4A2400', ring: '#A85E14', label: 'Leveled · Pending Review' },
    reb: { bg: '#C7C2F9', fg: '#241C6E', ring: '#5F55EE', label: 'Needs Rebid' },
    hld: { bg: '#F47B7B', fg: '#3E0707', ring: '#A82828', label: 'No Bid / Declined' },
    fnl: { bg: '#7DD68F', fg: '#0D3E18', ring: '#1F7A38', label: 'Awarded' },
    fu1: { bg: '#C8A7E6', fg: '#33124F', ring: '#6B3A95', label: 'Followed Up · W1' },
    fu2: { bg: '#F8CEAC', fg: '#4A2308', ring: '#A85F18', label: 'Followed Up · W2' },
    fu3: { bg: '#F5C8DD', fg: '#5A1338', ring: '#A8336E', label: 'Followed Up · W3' },
  };

  function handlePrint() {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const rows = trades.map((trade, ti) => {
      const subs5 = Array.from({ length: 5 }, (_, i) => trade.subs[i] ?? null);
      const rowBg = ti % 2 === 0 ? '#fff' : '#fafaf8';
      const cells = subs5.map(sub => {
        if (!sub) return `<td style="padding:6px 8px;border-bottom:0.5px solid #f0f0ec;text-align:center;color:#ccc;font-size:10px;background:${rowBg};">—</td>`;
        const s = PRINT_STATUS[sub.status as BidStatus] ?? PRINT_STATUS.ntb;
        const isLow = sub.amount !== null && sub.amount === trade.low && sub.status !== 'reb';
        const amt = sub.amount !== null ? '$' + Math.round(sub.amount).toLocaleString('en-US') : '—';
        return `<td style="padding:5px 6px;border-bottom:0.5px solid #f0f0ec;vertical-align:top;background:${rowBg};">
          <div style="background:${s.bg};color:${s.fg};border:1px solid ${s.ring};border-radius:4px 4px 0 0;border-bottom:none;padding:3px 6px;font-size:9.5px;text-align:center;font-weight:${isLow ? 700 : 500};line-height:1.3;">${sub.name}</div>
          <div style="background:${isLow ? '#e8f5e9' : '#f8f8f6'};color:${isLow ? '#1F7A38' : '#555'};border:1px solid ${isLow ? '#81c784' : '#e0e0dc'};border-top:none;border-radius:0 0 4px 4px;padding:2px 6px;font-size:9.5px;text-align:right;font-weight:${isLow ? 700 : 400};">${amt}</div>
        </td>`;
      }).join('');
      const lowStr = trade.low !== null ? '$' + Math.round(trade.low).toLocaleString('en-US') : '—';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:0.5px solid #f0f0ec;font-weight:600;font-size:11px;background:${rowBg};">
          ${trade.trade}
          <div style="font-size:9px;color:#aaa;margin-top:1px;">${trade.subs.length} sub${trade.subs.length !== 1 ? 's' : ''}</div>
        </td>
        ${cells}
        <td style="padding:8px 12px;border-bottom:0.5px solid #f0f0ec;text-align:right;font-weight:700;color:${trade.low !== null ? '#1F7A38' : '#aaa'};font-size:11px;background:${rowBg};">${lowStr}</td>
      </tr>`;
    }).join('');

    const totalStr = '$' + Math.round(runningLowTotal).toLocaleString('en-US');

    const legendHtml = (Object.entries(PRINT_STATUS) as [BidStatus, typeof PRINT_STATUS[BidStatus]][])
      .map(([, s]) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;background:${s.bg};color:${s.fg};border:1px solid ${s.ring};font-size:9px;font-weight:500;">${s.label}</span>`)
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bidding Report · ${project.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: #fff; padding: 24px 28px; }
    @page { size: landscape; margin: 10mm 12mm; }
    @media print { body { padding: 0; } }
    .header { display: flex; align-items: center; gap: 18px; border-bottom: 3px solid #F47832; padding-bottom: 14px; margin-bottom: 16px; }
    .logo-crop { width: 60px; height: 60px; overflow: hidden; position: relative; flex-shrink: 0; }
    .logo-img { position: absolute; width: 224px; height: auto; left: -18px; top: -1px; }
    .header-text h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    .header-text p { font-size: 11px; color: #888; margin-top: 3px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { background: #f8f8f6; border: 0.5px solid #e8e8e4; border-radius: 8px; padding: 9px 14px; }
    .kpi-val { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi-label { font-size: 9px; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
    .legend { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px 10px; font-size: 9px; letter-spacing: 0.07em; text-transform: uppercase; color: #888; background: #f5f5f2; border-bottom: 1px solid #e8e8e4; font-weight: 600; }
    th:first-child { text-align: left; }
    th:nth-child(n+2):nth-last-child(n+2) { text-align: center; }
    th:last-child { text-align: right; }
    .total-row td { background: #f5fdf7 !important; font-weight: 700; font-size: 11px; border-top: 2px solid #b2dfdb; padding: 9px 12px; }
    .footer { margin-top: 14px; font-size: 9.5px; color: #bbb; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-crop">
      <img class="logo-img" src="/lib_brand/lead_it_builders_logo.png" alt="Lead It Builders" />
    </div>
    <div class="header-text">
      <h1>Bidding Report · ${project.name}</h1>
      <p>${project.location || project.id} · Generated ${date}</p>
    </div>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${kpis.totalSubs}</div><div class="kpi-label">Total subs</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#1F7A38;">${kpis.fnlCount}</div><div class="kpi-label">Finalized</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#9C7A00;">${kpis.outCount}</div><div class="kpi-label">Out for bid</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#A82828;">${kpis.hldCount}</div><div class="kpi-label">On hold</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#1F7A38;">${totalStr}</div><div class="kpi-label">Lowest running</div></div>
  </div>
  <div class="legend">${legendHtml}</div>
  <table>
    <thead>
      <tr>
        <th>Trade</th>
        <th>Sub 1</th><th>Sub 2</th><th>Sub 3</th><th>Sub 4</th><th>Sub 5</th>
        <th>Lowest Bid</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="6">Total — lowest column — running</td>
        <td style="text-align:right;color:#1F7A38;">${totalStr}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <span>Lead It Builders · Bidding Dashboard · ${date}</span>
    <span>Color = bidding status from the 8-color palette · lowest bid highlighted in green</span>
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function handleCopyEmbedLink() {
    const url = `${SITE_URL}/bidding/${encodeURIComponent(project.name)}?embed=1`;
    const onSuccess = () => { setEmbedCopied(true); setTimeout(() => setEmbedCopied(false), 2500); };
    const execFallback = () => {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); onSuccess(); } catch (_) { /* silent */ }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(onSuccess).catch(execFallback);
    } else {
      execFallback();
    }
  }

  function handleShareLink() {
    const url = `${SITE_URL}/bidding/${encodeURIComponent(project.name)}/report`;
    const onSuccess = () => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    };
    const execFallback = () => {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); onSuccess(); } catch (_) { /* silent */ }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(onSuccess).catch(execFallback);
    } else {
      execFallback();
    }
  }

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
          flexWrap: 'wrap',
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
          {project.name} · Bidding
        </strong>
        <span style={{ flex: 1 }} />

        {/* Print / Share button group */}
        <div style={{ display: 'inline-flex', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', border: '0.5px solid var(--color-border-secondary)' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              borderRight: '0.5px solid var(--color-border-secondary)',
            }}
          >
            <i className="ti ti-printer" style={{ fontSize: 13 }} />
            Print
          </button>
          <button
            type="button"
            onClick={handleShareLink}
            title="Copy live report link to clipboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              background: shareCopied ? 'var(--bid-fnl-bg)' : 'var(--color-background-secondary)',
              color: shareCopied ? 'var(--bid-fnl-fg)' : 'var(--color-text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            <i className={`ti ${shareCopied ? 'ti-check' : 'ti-link'}`} style={{ fontSize: 13 }} />
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
          <button
            type="button"
            onClick={handleCopyEmbedLink}
            title="Copy stable embed URL for ClickUp"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
              background: embedCopied ? 'var(--bid-fnl-bg)' : 'var(--color-background-secondary)',
              color: embedCopied ? 'var(--bid-fnl-fg)' : 'var(--color-text-secondary)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            <i className={`ti ${embedCopied ? 'ti-check' : 'ti-brand-clickup'}`} style={{ fontSize: 13 }} />
            {embedCopied ? 'Copied!' : 'Copy embed link'}
          </button>
        </div>
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
          label="Total subs"
          caption={`across ${kpis.totalTrades} trades`}
          value={kpis.totalSubs}
          icon="ti-list"
          tone="info"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <KpiCard
          label="Finalized"
          caption="locked in"
          value={kpis.fnlCount}
          icon="ti-trophy"
          tone="good"
          active={filter === 'fnl'}
          onClick={() => setFilter(filter === 'fnl' ? 'all' : 'fnl')}
        />
        <KpiCard
          label="In flight"
          caption="sent → leveling"
          value={kpis.outCount}
          icon="ti-send"
          tone="info"
          active={filter === 'out'}
          onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
        />
        <KpiCard
          label="In leveling"
          caption="leveling + review"
          value={kpis.levCount}
          icon="ti-scale"
          tone="amber"
          active={filter === 'lev'}
          onClick={() => setFilter(filter === 'lev' ? 'all' : 'lev')}
        />
        <KpiCard
          label="No bid"
          caption="declined"
          value={kpis.hldCount}
          icon="ti-hand-stop"
          tone="danger"
          active={filter === 'hld'}
          onClick={() => setFilter(filter === 'hld' ? 'all' : 'hld')}
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
                const visibleSubs = filter === 'all'
                  ? trade.subs
                  : filter === 'fu'
                    ? trade.subs.filter(s => s.status === 'fu1' || s.status === 'fu2' || s.status === 'fu3')
                    : trade.subs.filter(s => s.status === filter);
                const subs5: (BidSub | null)[] = Array.from({ length: 5 }, (_, i) => visibleSubs[i] ?? null);
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
                      const isLow = sub.amount !== null && sub.amount === trade.low && sub.status !== 'reb';
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
                          {/* name block — neutral, single color */}
                          <div
                            style={{
                              display: 'block',
                              padding: '5px 8px',
                              borderRadius: isLow ? '5px 5px 0 0' : 5,
                              border: isLow
                                ? '1px solid var(--good-strong)'
                                : '1px solid var(--color-border-tertiary)',
                              borderBottom: isLow ? 'none' : undefined,
                              fontSize: 11.5,
                              textAlign: 'center',
                              fontWeight: 500,
                              minHeight: 26,
                              background: isLow ? 'var(--good-bg)' : 'var(--color-background-secondary)',
                              color: isLow ? 'var(--good-fg)' : 'var(--color-text-primary)',
                            }}
                          >
                            {sub.name}
                          </div>
                          {/* amount block — green only for lowest */}
                          {isLow && (
                            <div
                              style={{
                                display: 'block',
                                padding: '5px 8px',
                                border: '1px solid var(--good-strong)',
                                borderTop: 'none',
                                borderRadius: '0 0 5px 5px',
                                fontSize: 11.5,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                minHeight: 26,
                                background: 'var(--good-bg)',
                                color: 'var(--good-fg)',
                                fontWeight: 600,
                              }}
                            >
                              {sub.amount !== null ? fmt$(sub.amount) : '—'}
                            </div>
                          )}
                          {!isLow && sub.amount !== null && (
                            <div
                              style={{
                                display: 'block',
                                padding: '3px 8px',
                                fontSize: 11,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              {fmt$(sub.amount)}
                            </div>
                          )}
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

  const portfolioData = useBiddingPortfolio();

  // Map: projectName → Map<tradeName, BidTrade>
  const projectTradeMap = useMemo(() => {
    const map = new Map<string, Map<string, BidTrade>>();
    if (!portfolioData) return map;
    for (const proj of portfolioData.projects) {
      const tm = new Map<string, BidTrade>();
      for (const t of proj.trades) tm.set(t.trade, t);
      map.set(proj.name, tm);
    }
    return map;
  }, [portfolioData]);

  // Sorted union of all trade names across all portfolio projects,
  // filtered by current search query.
  const allTradeNames = useMemo(() => {
    const names = new Set<string>();
    for (const [, tm] of projectTradeMap) for (const n of tm.keys()) names.add(n);
    // Also include trades from the selected project (in case portfolio data lags)
    for (const t of project.trades) names.add(t.trade);
    let sorted = [...names].sort();
    if (search.trim()) {
      const q = search.toLowerCase();
      sorted = sorted.filter(n => n.toLowerCase().includes(q));
    }
    return sorted;
  }, [projectTradeMap, project.trades, search]);

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
            {portfolioData === null ? (
              <tr>
                <td colSpan={9} style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  <i className="ti ti-loader" /> Loading portfolio…
                </td>
              </tr>
            ) : (
              allTradeNames.map((tradeName, ti) => {
                const isEven = ti % 2 === 0;
                // For the sticky trade-name cell, use the first real project's trade for highlighting
                const firstRealProj = cols.find(p => p.isReal);
                const firstTrade = firstRealProj
                  ? projectTradeMap.get(firstRealProj.name)?.get(tradeName)
                  : undefined;
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
                      {tradeName}
                      {firstTrade?.annot && (
                        <div style={{ fontSize: 9, color: 'var(--danger-fg)', fontStyle: 'italic', marginTop: 1 }}>
                          {firstTrade.annot}
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
                      const trade = projectTradeMap.get(proj.name)?.get(tradeName);
                      const ts = trade ? tradeStatus(trade) : null;
                      const m = ts ? STATUS_META[ts] : null;
                      const cellTaskId = m ? trade?.taskId : undefined;
                      return (
                        <td
                          key={pi}
                          className={cellTaskId ? 'matrix-task-cell' : undefined}
                          title={cellTaskId ? `Open ${tradeName} · ${proj.name} in ClickUp` : undefined}
                          onClick={cellTaskId ? () => window.open(taskUrl(cellTaskId), '_blank', 'noopener') : undefined}
                          style={{
                            padding: '4px 6px',
                            border: '0.5px solid var(--color-border-tertiary)',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {trade === undefined ? (
                            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>—</span>
                          ) : m ? (
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
                              {m.short}
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
              })
            )}
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
          t.subs.some((s) => s.status === 'rec') &&
          !t.subs.some((s) => s.status === 'fnl' || s.status === 'lvl' || s.status === 'lvp'),
      ),
    },
    {
      key: 'lvl',
      label: 'Leveling',
      items: trades.filter(
        (t) =>
          t.subs.some((s) => s.status === 'lvl' || s.status === 'lvp') &&
          !t.subs.some((s) => s.status === 'fnl'),
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
      label: 'No Bid',
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
        gridTemplateColumns: 'repeat(6, 1fr)',
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
                onClick={() => trade.taskId && window.open(`https://app.clickup.com/t/${trade.taskId}`, '_blank', 'noopener')}
                style={{
                  background: 'var(--color-background-primary)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  marginBottom: 6,
                  border: `0.5px solid ${m.ring}`,
                  cursor: trade.taskId ? 'pointer' : 'default',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500 }}>{trade.trade}{trade.taskId && <i className="ti ti-external-link" style={{ fontSize: 9, opacity: 0.4, marginLeft: 4 }} />}</div>
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

// ─── Portfolio matrix view ─────────────────────────────────────────────────────

type ProjectFilter = 'all' | 'active' | 'blank';
// Matrix ordering. 'data' (the default) pulls everything with bidding activity
// to the front and pushes empty projects/trades to the end; 'name' is the plain
// alphabetical order the matrix used to have.
type MatrixSort = 'data' | 'name';

const byNameAsc = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

function PortfolioMatrixView({
  portfolioData,
  onNavigateToProject,
  search,
}: {
  portfolioData: BiddingPortfolioPayload;
  onNavigateToProject: (id: string) => void;
  search: string;
}) {
  // Unlinked projects (no Master Projects Board record) are held out of the
  // matrix and its counts so they can't silently distort the portfolio; they're
  // surfaced separately in an admin warning banner below.
  const unlinkedNames = useMemo(
    () =>
      portfolioData.unlinkedProjects?.length
        ? portfolioData.unlinkedProjects
        : portfolioData.projects.filter((p) => p.unlinked).map((p) => p.name),
    [portfolioData],
  );
  const linkedProjects = useMemo(
    () => portfolioData.projects.filter((p) => !p.unlinked),
    [portfolioData],
  );

  // How many trades in a project carry any bidding activity. Zero means the
  // column is all dashes — that project is "blank".
  const projectBidCount = useCallback(
    (proj: BiddingProject) =>
      proj.trades.reduce((n, t) => n + (tradeStatus(t) !== null ? 1 : 0), 0),
    [],
  );
  // A project is "blank" when no trade has any bidding activity (every cell is a
  // dash). Drives the blank / has-bids column filter.
  const isBlankProject = useCallback(
    (proj: BiddingProject) => projectBidCount(proj) === 0,
    [projectBidCount],
  );

  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [tradeFilter, setTradeFilter] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<MatrixSort>('data');

  // Columns: apply the blank / has-bids filter, then order. The default puts the
  // busiest projects first and leaves the empty ones trailing at the end.
  const projects = useMemo(() => {
    const filtered =
      projectFilter === 'all'
        ? linkedProjects
        : projectFilter === 'blank'
        ? linkedProjects.filter(isBlankProject)
        : linkedProjects.filter((p) => !isBlankProject(p));
    if (sort === 'name') return [...filtered].sort((a, b) => byNameAsc(a.name, b.name));
    return [...filtered].sort(
      (a, b) => projectBidCount(b) - projectBidCount(a) || byNameAsc(a.name, b.name),
    );
  }, [linkedProjects, projectFilter, isBlankProject, projectBidCount, sort]);

  const blankCount = useMemo(
    () => linkedProjects.filter(isBlankProject).length,
    [linkedProjects, isBlankProject],
  );

  const projectTradeMap = useMemo(() => {
    const map = new Map<string, Map<string, BidTrade>>();
    for (const proj of projects) {
      const tm = new Map<string, BidTrade>();
      for (const t of proj.trades) tm.set(t.trade, t);
      map.set(proj.name, tm);
    }
    return map;
  }, [projects]);

  // Every trade name across all linked projects — the pool for the trade filter.
  const everyTradeName = useMemo(() => {
    const names = new Set<string>();
    for (const proj of linkedProjects) for (const t of proj.trades) names.add(t.trade);
    return [...names].sort();
  }, [linkedProjects]);

  // Rows: text search AND the explicit trade multi-select (empty = all), then the
  // same data-first ordering as the columns — trades with bids across the visible
  // projects lead, all-empty trades sink to the bottom.
  const tradeNames = useMemo(() => {
    const bidCounts = new Map<string, number>();
    for (const [, tm] of projectTradeMap) {
      for (const [name, trade] of tm) {
        bidCounts.set(
          name,
          (bidCounts.get(name) ?? 0) + (tradeStatus(trade) !== null ? 1 : 0),
        );
      }
    }
    let names = [...bidCounts.keys()];
    if (tradeFilter.size) names = names.filter((n) => tradeFilter.has(n));
    const q = search.trim().toLowerCase();
    if (q) names = names.filter((n) => n.toLowerCase().includes(q));
    if (sort === 'name') return names.sort(byNameAsc);
    return names.sort(
      (a, b) => (bidCounts.get(b) ?? 0) - (bidCounts.get(a) ?? 0) || byNameAsc(a, b),
    );
  }, [projectTradeMap, tradeFilter, search, sort]);

  // Hover tooltip — imperatively positioned so mouse-move doesn't re-render the grid.
  const tipRef = useRef<HTMLDivElement | null>(null);
  const showTip = (e: React.MouseEvent<HTMLElement>, html: string) => {
    const tip = tipRef.current;
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.opacity = '1';
    tip.style.left = `${e.clientX + 14}px`;
    tip.style.top = `${e.clientY + 14}px`;
  };
  const moveTip = (e: React.MouseEvent<HTMLElement>) => {
    const tip = tipRef.current;
    if (!tip) return;
    tip.style.left = `${e.clientX + 14}px`;
    tip.style.top = `${e.clientY + 14}px`;
  };
  const hideTip = () => {
    if (tipRef.current) tipRef.current.style.opacity = '0';
  };

  const filtersActive =
    projectFilter !== 'all' || tradeFilter.size > 0 || sort !== 'data';

  return (
    <>
      {unlinkedNames.length > 0 && <UnlinkedProjectsWarning names={unlinkedNames} />}
      <SectionCard title="Portfolio bidding matrix — all projects" icon="ti-table">
      {/* Filter toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <ProjectColumnFilter
          value={projectFilter}
          onChange={setProjectFilter}
          total={linkedProjects.length}
          blank={blankCount}
        />
        <TradeFilter
          all={everyTradeName}
          selected={tradeFilter}
          onChange={setTradeFilter}
        />
        <MatrixSortToggle value={sort} onChange={setSort} />
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setProjectFilter('all');
              setTradeFilter(new Set());
              setSort('data');
            }}
            style={{
              height: 30,
              padding: '0 10px',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 13 }} /> Clear filters
          </button>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
          }}
        >
          {tradeNames.length} {tradeNames.length === 1 ? 'trade' : 'trades'} ·{' '}
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </span>
      </div>

      {/* The wrapper is the scrollport in both axes, so <thead> can stay frozen
          against it while the rows scroll underneath. */}
      <div className="matrix-scroll matrix-scroll-frozen">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <colgroup>
            <col style={{ minWidth: 200 }} />
            {projects.map((_, i) => (
              <col key={i} style={{ minWidth: 130 }} />
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
                  top: 0,
                  left: 0,
                  // Above both the sticky header row and the sticky trade column.
                  zIndex: 4,
                  // border-collapse drops sticky cell borders while scrolling;
                  // inset shadows keep the grid lines painted.
                  boxShadow: 'inset -1px -1px 0 var(--color-border-tertiary)',
                }}
              >
                Trade
              </th>
              {projects.map((proj) => (
                <th
                  key={proj.name}
                  style={{
                    textAlign: 'center',
                    padding: '7px 8px',
                    fontSize: 10,
                    color: 'var(--color-text-primary)',
                    fontWeight: 600,
                    background: 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                    maxWidth: 130,
                    position: 'sticky',
                    top: 0,
                    zIndex: 3,
                    boxShadow: 'inset 0 -1px 0 var(--color-border-tertiary)',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      maxWidth: '100%',
                    }}
                  >
                    <button
                      type="button"
                      title={`View ${proj.name}`}
                      onClick={() => onNavigateToProject(proj.name)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        fontWeight: 600,
                        letterSpacing: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {proj.name}
                    </button>
                    {proj.folderId && (
                      <a
                        href={folderUrl(proj.folderId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${proj.name} in ClickUp`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: 'var(--color-text-tertiary)',
                          flexShrink: 0,
                          lineHeight: 0,
                        }}
                      >
                        <i className="ti ti-external-link" style={{ fontSize: 12 }} />
                      </a>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tradeNames.length === 0 ? (
              <tr>
                <td
                  colSpan={projects.length + 1}
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 12,
                  }}
                >
                  {search || filtersActive
                    ? 'No trades match the current filters.'
                    : 'No bidding data yet.'}
                </td>
              </tr>
            ) : (
              tradeNames.map((tradeName, ti) => (
                <tr key={ti}>
                  <td
                    style={{
                      padding: '7px 12px',
                      border: '0.5px solid var(--color-border-tertiary)',
                      fontWeight: 500,
                      background: 'var(--color-background-primary)',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      boxShadow: 'inset -1px 0 0 var(--color-border-tertiary)',
                    }}
                  >
                    {tradeName}
                  </td>
                  {projects.map((proj) => {
                    const trade = projectTradeMap.get(proj.name)?.get(tradeName);
                    const ts = trade ? tradeStatus(trade) : null;
                    const liveColor = trade ? tradeStatusColor(trade) : null;
                    const url = trade ? tradeClickUpUrl(trade) : null;
                    const linkable = !!(ts && url);
                    return (
                      <td
                        key={proj.name}
                        className={linkable ? 'matrix-task-cell' : undefined}
                        onClick={linkable ? () => window.open(url!, '_blank', 'noopener') : undefined}
                        onMouseEnter={
                          trade && ts
                            ? (e) => showTip(e, tradeTipHtml(trade, proj.name))
                            : undefined
                        }
                        onMouseMove={trade && ts ? moveTip : undefined}
                        onMouseLeave={trade && ts ? hideTip : undefined}
                        style={{
                          padding: '6px 8px',
                          border: '0.5px solid var(--color-border-tertiary)',
                          textAlign: 'center',
                          background: ts
                            ? liveColor
                              ? hexToRgba(liveColor, 0.14)
                              : STATUS_META[ts].bg
                            : undefined,
                          cursor: linkable ? 'pointer' : undefined,
                        }}
                      >
                        {ts ? (
                          <StatusPill status={ts} small color={liveColor} />
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Floating hover tooltip — sub-level breakdown for the hovered cell */}
      <div
        ref={tipRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 1000,
          opacity: 0,
          transition: 'opacity .12s',
          maxWidth: 300,
          background: 'var(--color-background-primary)',
          color: 'var(--color-text-primary)',
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          padding: '10px 12px',
          fontSize: 11.5,
          lineHeight: 1.45,
        }}
      />
      </SectionCard>
    </>
  );
}

// Builds the hover-card HTML for a trade cell: each sub with its ClickUp status
// color, name and amount. Rendered via innerHTML, so every field is escaped.
function tradeTipHtml(trade: BidTrade, projectName: string): string {
  const head = `
    <div style="font-weight:600;margin-bottom:1px;">${escapeAttr(trade.trade)}</div>
    <div style="color:var(--color-text-tertiary);margin-bottom:7px;">${escapeAttr(projectName)}</div>`;
  if (!trade.subs.length) {
    return head + `<div style="color:var(--color-text-tertiary);font-style:italic;">No subs entered yet</div>`;
  }
  const rows = trade.subs
    .map((sub) => {
      const m = STATUS_META[sub.status];
      const dot = sub.color || m.strong;
      const amt =
        sub.amount !== null ? '$' + Math.round(sub.amount).toLocaleString('en-US') : '—';
      return `
        <div style="display:flex;align-items:center;gap:7px;padding:2px 0;">
          <span style="width:8px;height:8px;border-radius:50%;background:${escapeAttr(dot)};flex-shrink:0;"></span>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeAttr(sub.name)}</span>
          <span style="color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${escapeAttr(amt)}</span>
        </div>
        <div style="color:var(--color-text-tertiary);font-size:10.5px;margin:-1px 0 4px 15px;">${escapeAttr(m.label)}</div>`;
    })
    .join('');
  return head + rows;
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

// ─── Portfolio matrix filters ──────────────────────────────────────────────────

function ProjectColumnFilter({
  value,
  onChange,
  total,
  blank,
}: {
  value: ProjectFilter;
  onChange: (v: ProjectFilter) => void;
  total: number;
  blank: number;
}) {
  const OPTIONS: { v: ProjectFilter; label: string; count: number }[] = [
    { v: 'all', label: 'All projects', count: total },
    { v: 'active', label: 'With bids', count: total - blank },
    { v: 'blank', label: 'Blank', count: blank },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 2,
        gap: 2,
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
      }}
    >
      {OPTIONS.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'var(--color-background-primary)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: active ? 600 : 400,
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 1px rgba(0,0,0,0.04)' : undefined,
            }}
          >
            {o.label}
            <span
              style={{
                fontSize: 10,
                padding: '0 4px',
                borderRadius: 3,
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {o.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Ordering toggle for the portfolio matrix. Defaults to "With data first", which
// fronts the projects/trades that actually have bids and trails the empty ones.
function MatrixSortToggle({
  value,
  onChange,
}: {
  value: MatrixSort;
  onChange: (v: MatrixSort) => void;
}) {
  const OPTIONS: { v: MatrixSort; label: string; title: string }[] = [
    {
      v: 'data',
      label: 'With data first',
      title: 'Most bidding activity first · empty projects and trades last',
    },
    {
      v: 'name',
      label: 'A → Z',
      title: 'Alphabetical by project and trade name',
    },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 2,
        gap: 2,
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
      }}
    >
      <i
        className="ti ti-arrows-sort"
        style={{
          fontSize: 14,
          margin: '0 2px 0 6px',
          color: 'var(--color-text-tertiary)',
        }}
      />
      {OPTIONS.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            title={o.title}
            onClick={() => onChange(o.v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'var(--color-background-primary)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: active ? 600 : 400,
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 1px rgba(0,0,0,0.04)' : undefined,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TradeFilter({
  all,
  selected,
  onChange,
}: {
  all: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((n) => n.toLowerCase().includes(needle)) : all;
  }, [all, q]);

  const label = selected.size ? `Trades · ${selected.size}` : 'All trades';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Filter trades"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 10px',
          background:
            selected.size > 0 ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <i className="ti ti-filter" style={{ fontSize: 13 }} />
        {label}
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 12, opacity: 0.6 }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            left: 0,
            top: 'calc(100% + 6px)',
            zIndex: 60,
            width: 260,
            padding: 6,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          }}
        >
          <input
            type="search"
            autoFocus
            placeholder="Filter trades…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              width: '100%',
              height: 30,
              padding: '0 8px',
              marginBottom: 6,
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 12.5,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '2px 6px 6px',
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {selected.size} selected
            </span>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-info)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <div style={{ padding: '10px 8px', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                No trades match.
              </div>
            ) : (
              visible.map((name) => {
                const checked = selected.has(name);
                return (
                  <label
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12.5,
                      background: checked ? 'var(--color-background-secondary)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(name)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Unlinked-projects admin warning ───────────────────────────────────────────
// Shown when an Active-Projects folder has no Master Projects Board record. The
// folder is excluded from the matrix/counts above; this banner makes the gap
// visible so an admin can register the project (or link the folder) in ClickUp.
function UnlinkedProjectsWarning({ names }: { names: string[] }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        marginBottom: 12,
        background: 'var(--warn-bg, rgba(250,199,117,0.16))',
        border: '1px solid var(--warn-strong)',
        borderRadius: 'var(--border-radius-md)',
        fontSize: 12.5,
        color: 'var(--warn-fg, var(--color-text-primary))',
      }}
    >
      <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: 'var(--warn-strong)', flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          {names.length === 1 ? '1 project is' : `${names.length} projects are`} not linked to the Master Projects Board
        </div>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          Excluded from the matrix and portfolio counts until registered in ClickUp:{' '}
          <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{names.join(', ')}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main BiddingDashboard ─────────────────────────────────────────────────────

type ProjectTab = 'matrix' | 'pipeline' | 'followups' | 'subs';

const PROJECT_TABS: { id: ProjectTab; label: string; icon: string }[] = [
  { id: 'matrix',    label: 'Trade Matrix', icon: 'ti-table-options' },
  { id: 'pipeline',  label: 'Pipeline',     icon: 'ti-git-branch' },
  { id: 'followups', label: 'Follow-ups',   icon: 'ti-message-2' },
  { id: 'subs',      label: 'Subs',         icon: 'ti-users' },
];

export function BiddingDashboard({ projectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = ((searchParams?.get('tab') ?? 'matrix') as ProjectTab);
  const isEmbed = searchParams?.get('embed') === '1';
  const [search, setSearch] = useState('');
  const [embedCopied, setEmbedCopied] = useState(false);

  const navigateToProject = useCallback(
    (id: string) => router.push(`/bidding/${encodeURIComponent(id)}`),
    [router],
  );
  const navigateToPortfolio = useCallback(() => router.push('/bidding'), [router]);
  const setTab = useCallback(
    (newTab: ProjectTab) => {
      if (!projectId) return;
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', newTab);
      router.push(`/bidding/${encodeURIComponent(projectId)}?${params.toString()}`);
    },
    [router, projectId, searchParams],
  );

  // Portfolio data — only fetched in portfolio mode
  const { data: portfolioData, isLoading: portfolioLoading } = useSWR<BiddingPortfolioPayload>(
    projectId ? null : '/api/bidding/portfolio',
    portfolioFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  // Per-project data — only fetched in project mode
  const { data: projectData, isLoading: projectLoading } = useSWR<BiddingPayload>(
    projectId ? `/api/bidding/project/${encodeURIComponent(projectId)}` : null,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const isLoading = projectId ? projectLoading : portfolioLoading;

  const syncedAt = projectId
    ? (projectData?.syncedAt ?? null)
    : (portfolioData?.syncedAt ?? null);

  const subtitle = useMemo(() => {
    if (projectId) {
      if (!projectData) return 'Loading…';
      const fnlCount = projectData.project.trades.filter((t) =>
        t.subs.some((s) => s.status === 'fnl'),
      ).length;
      return `${projectData.project.trades.length} trades · ${fnlCount} finalized`;
    }
    if (!portfolioData) return 'Loading…';
    return `${portfolioData.projects.length} projects · all bidding lists`;
  }, [projectId, projectData, portfolioData]);

  // Project names for the picker — populated from whichever payload is available
  const allProjectNames = useMemo(() => {
    if (projectData) return projectData.portfolioProjects.map((p) => p.name);
    if (portfolioData) return portfolioData.projects.map((p) => p.name);
    return [];
  }, [projectData, portfolioData]);

  // Loading skeleton
  if (isLoading || (projectId ? !projectData : !portfolioData)) {
    return (
      <>
        {!isEmbed && <LogoHeader title="Bidding Dashboard" subtitleOverride="Loading from ClickUp…" syncedAt={null} />}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 240,
            color: 'var(--color-text-tertiary)',
            fontSize: 13,
          }}
        >
          <i
            className="ti ti-loader"
            style={{ fontSize: 20, marginRight: 8, animation: 'lib-spin 1s linear infinite' }}
          />
          Loading bidding data…
        </div>
      </>
    );
  }

  // No-token warning (portfolio mode)
  if (!projectId && portfolioData!.source === 'empty') {
    return (
      <>
        {!isEmbed && <LogoHeader title="Bidding Dashboard" subtitleOverride="No ClickUp token" syncedAt={null} />}
        <div style={{ padding: '32px 24px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          <strong>No data available.</strong> Add <code>CLICKUP_API_TOKEN</code> to{' '}
          <code>.env.local</code> to load live data.
        </div>
      </>
    );
  }

  // No-token warning (project mode)
  if (projectId && projectData!.warning) {
    return (
      <>
        {!isEmbed && <LogoHeader title="Bidding Dashboard" subtitleOverride={projectData!.warning} syncedAt={null} />}
        <div style={{ padding: '32px 24px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          <strong>No data available.</strong> {projectData!.warning}
        </div>
      </>
    );
  }

  return (
    <>
      {!isEmbed && (
        <LogoHeader
          title="Bidding Dashboard"
          subtitleOverride={subtitle}
          syncedAt={syncedAt}
        />
      )}
      {isEmbed && <EmbedSyncBar syncedAt={syncedAt} />}

      {/* Filter / navigation bar */}
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
        {/* Search input */}
        <div className="bidding-search" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
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

        {/* Project picker — "★ All projects" is always first */}
        <ProjectPicker
          projectId={projectId}
          projectNames={allProjectNames}
          onPortfolio={navigateToPortfolio}
          onProject={navigateToProject}
          isEmbed={isEmbed}
        />

        {/* Copy embed link — per-project, non-embed mode only */}
        {!isEmbed && projectId && (
          <button
            type="button"
            onClick={() => {
              const url = `${SITE_URL}/bidding/${encodeURIComponent(projectId)}?embed=1`;
              navigator.clipboard.writeText(url).then(() => {
                setEmbedCopied(true);
                setTimeout(() => setEmbedCopied(false), 2000);
              });
            }}
            style={{
              height: 32, padding: '0 12px',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              background: embedCopied ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
              color: embedCopied ? 'var(--good-strong)' : 'var(--color-text-secondary)',
              fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <i className={`ti ${embedCopied ? 'ti-check' : 'ti-link'}`} style={{ fontSize: 14 }} />
            {embedCopied ? 'Copied!' : 'Copy embed link'}
          </button>
        )}

        {/* Tab strip — per-project mode only */}
        {projectId && (
          <div
            className="bidding-tabs"
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              background: 'var(--color-background-secondary)',
              borderRadius: 'var(--border-radius-md)',
              marginLeft: 'auto',
            }}
          >
            {PROJECT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <i className={`ti ${t.icon}`} style={{ fontSize: 13, marginRight: 5 }} />
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content — portfolio mode */}
      {!projectId && (
        <PortfolioMatrixView
          portfolioData={portfolioData!}
          onNavigateToProject={navigateToProject}
          search={search}
        />
      )}

      {/* Content — per-project mode */}
      {projectId && projectData && (
        <BiddingCtx.Provider value={projectData}>
          {tab === 'matrix' && (
            <DetailedView onBack={navigateToPortfolio} search={search} />
          )}
          {tab === 'pipeline' && <PipelineView search={search} />}
          {tab === 'followups' && <FollowUpsView search={search} />}
          {tab === 'subs' && <SubsView search={search} />}
        </BiddingCtx.Provider>
      )}

      {/* Footer */}
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
          Live from ClickUp · 60-second cache · click any trade row or sub cell to open in ClickUp
        </div>
        <div>
          Color = bidding status from the 8-color PDF palette
        </div>
      </div>
    </>
  );
}
