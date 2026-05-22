'use client';

import { useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { LogoHeader } from '@/components/LogoHeader';
import { BUDGET_SAMPLE } from '@/lib/budget-data';
import type { BudgetTrade, MoneyVal } from '@/lib/budget-types';

// ──────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────
function isMoney(v: MoneyVal): v is number {
  return typeof v === 'number';
}

function fmt$(v: MoneyVal): string {
  if (v === null || v === undefined) return '$–';
  if (v === 'INC') return 'Included';
  if (v === 'NA') return 'NA';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e4) return '$' + (v / 1e3).toFixed(0) + 'k';
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtFull$(v: MoneyVal): string {
  if (v === null || v === undefined) return '$–';
  if (v === 'INC') return 'Included';
  if (v === 'NA') return 'NA';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function siblingEstM(idx: number): number {
  const seed = ((idx + 7) * 173) % 100;
  return 4 + (seed / 100) * 18;
}

// ──────────────────────────────────────────────────────────────
// stats
// ──────────────────────────────────────────────────────────────
function computeStats(trades: BudgetTrade[]) {
  let est = 0, fin = 0, newv = 0;
  let withBids = 0, eo = 0, inc = 0, na = 0, manual = 0;
  for (const r of trades) {
    if (isMoney(r.est)) est += r.est;
    if (isMoney(r.fin)) fin += r.fin;
    if (isMoney(r.newv)) newv += r.newv;
    if (isMoney(r.fin)) withBids++;
    if (isMoney(r.est) && !isMoney(r.fin) && r.newv !== 'INC' && r.newv !== 'NA') eo++;
    if (r.est === 'INC' || r.fin === 'INC' || r.newv === 'INC') inc++;
    if (r.est === 'NA' || r.newv === 'NA') na++;
    if (r.manual) manual++;
  }
  return { est, fin, newv, withBids, eo, inc, na, manual, count: trades.length };
}

// ──────────────────────────────────────────────────────────────
// sub-components
// ──────────────────────────────────────────────────────────────
type Tone = 'default' | 'info' | 'good' | 'amber' | 'danger';

const toneColors: Record<Tone, { v: string; icon: string }> = {
  default: { v: 'var(--color-text-primary)',    icon: 'rgba(154,154,154,0.10)' },
  info:    { v: 'var(--info-strong)',            icon: 'rgba(24,95,165,0.10)' },
  good:    { v: 'var(--good-strong)',            icon: 'rgba(59,109,17,0.10)' },
  amber:   { v: '#854F0B',                       icon: 'rgba(186,117,23,0.10)' },
  danger:  { v: '#791F1F',                       icon: 'rgba(163,45,45,0.10)' },
};

function KpiCard({
  label, value, sub, icon, tone = 'default',
}: {
  label: string; value: string; sub?: string; icon: string; tone?: Tone;
}) {
  const { v: vColor, icon: iconBg } = toneColors[tone];
  return (
    <div style={{
      background: 'var(--color-background-secondary)',
      border: '0.5px solid transparent',
      borderRadius: 'var(--border-radius-md)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.2 }}>{label}</div>
        <div style={{
          fontSize: 30, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.015em', lineHeight: 1.1, color: vColor, marginTop: 2,
        }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{sub}</div>}
      </div>
      <span style={{
        width: 40, height: 40, flexShrink: 0, borderRadius: 999,
        background: iconBg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: vColor,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22 }} />
      </span>
    </div>
  );
}

function MoneyToken({ v, bold, dim }: { v: MoneyVal; bold?: boolean; dim?: boolean }) {
  if (v === 'INC') return (
    <span style={{
      fontStyle: 'italic', color: 'var(--color-text-tertiary)',
      background: 'var(--color-background-secondary)',
      padding: '2px 8px', borderRadius: 4, fontSize: 11.5, fontWeight: 400, display: 'inline-block',
    }}>Included</span>
  );
  if (v === 'NA') return (
    <span style={{
      fontStyle: 'italic', color: 'var(--color-text-tertiary)',
      border: '0.5px dashed var(--color-border-secondary)',
      padding: '2px 8px', borderRadius: 4, fontSize: 11.5, fontWeight: 400, display: 'inline-block',
    }}>NA</span>
  );
  const text = v === null ? '$–' : fmt$(v);
  return (
    <span style={{
      color: (dim || v === null) ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
      fontWeight: bold ? 600 : 400,
    }}>{text}</span>
  );
}

function VarBar({ r }: { r: BudgetTrade }) {
  if (!isMoney(r.est) || !isMoney(r.fin)) {
    let label = 'estimate-only';
    if (r.est === 'NA' || r.newv === 'NA') label = '—';
    else if (r.est === 'INC' || r.fin === 'INC') label = 'rolled-up';
    return (
      <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--color-border-secondary)' }} />
        <div style={{ position: 'relative', zIndex: 2, fontSize: 10.5, width: '100%', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>{label}</div>
      </div>
    );
  }
  const delta = r.fin - r.est;
  const denom = Math.max(Math.abs(r.est), Math.abs(r.fin), 1);
  const pct = Math.min(50, Math.abs(delta) / denom * 50);
  const dl = delta === 0 ? '$0' : (delta < 0 ? '−' : '+') + fmt$(Math.abs(delta));
  const dp = r.est > 0 ? ' · ' + (delta / r.est * 100).toFixed(0) + '%' : '';
  return (
    <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
      {delta < 0 && (
        <div style={{ position: 'absolute', top: 3, bottom: 3, right: '50%', width: `${pct}%`, borderRadius: 3, background: 'var(--var-under)' }} />
      )}
      {delta > 0 && (
        <div style={{ position: 'absolute', top: 3, bottom: 3, left: '50%', width: `${pct}%`, borderRadius: 3, background: 'var(--var-over)' }} />
      )}
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--color-border-secondary)' }} />
      <div style={{
        position: 'relative', zIndex: 2, fontSize: 10.5, fontVariantNumeric: 'tabular-nums',
        fontWeight: 500, width: '100%', textAlign: 'center', lineHeight: 1,
        color: delta === 0 ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        textShadow: '0 0 4px var(--color-background-primary), 0 0 4px var(--color-background-primary)',
      }}>{dl}{dp}</div>
    </div>
  );
}

function SparkBar({ ghost, finalized, total }: { ghost?: boolean; finalized?: number; total?: number }) {
  const bars = Array.from({ length: 14 }, (_, i) => {
    const filled = !ghost && i < (finalized ?? 0);
    return (
      <div key={i} style={{
        flex: 1, borderRadius: 1,
        background: ghost ? 'var(--color-border-tertiary)' : filled ? 'var(--var-under)' : 'var(--var-zero)',
        minHeight: 2,
        height: `${60 + (i * 137) % 40}%`,
        alignSelf: 'flex-end',
      }} />
    );
  });
  return (
    <div style={{ display: 'flex', gap: 1, height: 18, alignItems: 'flex-end', width: 96 }}>
      {bars}
    </div>
  );
}

function SideCard({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '16px 18px',
      marginBottom: 14,
    }}>
      <h3 style={{
        margin: '0 0 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--color-text-tertiary)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
        {title}
      </h3>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ManualBadge — shared
// ──────────────────────────────────────────────────────────────
function ManualBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      marginLeft: 8, padding: '1px 6px', borderRadius: 999,
      background: 'var(--warn-bg)', color: 'var(--warn-fg)',
      fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      border: '1px solid rgba(186,117,23,0.35)',
    }}>
      <i className="ti ti-settings-2" style={{ fontSize: 9 }} /> Manual
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// ProjectHeroCard — shared
// ──────────────────────────────────────────────────────────────
function ProjectHeroCard({ onBack }: { onBack: () => void }) {
  const { project } = BUDGET_SAMPLE;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start',
      paddingBottom: 14, borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 14,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em', margin: '0 0 6px' }}>{project.name}</h1>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--c-sol-bg)', color: 'var(--c-sol-dark)' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', color: 'var(--c-sol-dark)', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{project.coordInitials}</span>
            {project.coordName}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--info-bg)', color: 'var(--info-fg)' }}>
            <i className="ti ti-calculator" style={{ fontSize: 13 }} />{project.phase}
          </span>
          <span><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: '-2px' }} /> {project.location}</span>
          <span><i className="ti ti-id" style={{ fontSize: 13, verticalAlign: '-2px' }} /> {project.id}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onBack}
          style={{ height: 32, padding: '0 13px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <i className="ti ti-arrow-left" /> Table view
        </button>
        <button style={{ height: 32, padding: '0 13px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--lib-black)', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--lib-black)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
          <i className="ti ti-external-link" /> Open in ClickUp
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// drawer
// ──────────────────────────────────────────────────────────────
function Drawer({
  open, trade, onClose,
}: {
  open: boolean;
  trade: BudgetTrade | null;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)',
          zIndex: 90, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--color-background-primary)',
        borderLeft: '0.5px solid var(--color-border-tertiary)',
        zIndex: 91,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 250ms ease',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.10)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{trade?.trade ?? '—'}</h2>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>Budget detail</div>
          </div>
          <i
            className="ti ti-x"
            style={{ fontSize: 18, cursor: 'pointer', color: 'var(--color-text-secondary)' }}
            onClick={onClose}
          />
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, fontSize: 13 }}>
          {trade && (
            <>
              <h4 style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: '0 0 8px' }}>Budget figures</h4>
              {[
                { label: 'Estimated', val: trade.est },
                { label: 'Finalized / lowest bid', val: trade.fin },
                { label: 'New Budget', val: trade.newv },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: 13, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                  <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    <MoneyToken v={val} bold />
                  </span>
                </div>
              ))}
              {isMoney(trade.est) && isMoney(trade.fin) && (() => {
                const delta = trade.fin - trade.est;
                const pct = trade.est > 0 ? (delta / trade.est * 100).toFixed(1) : '—';
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Variance vs Estimated</span>
                    <span style={{
                      fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      color: delta < 0 ? 'var(--var-under)' : delta > 0 ? 'var(--var-over)' : 'var(--color-text-tertiary)',
                    }}>
                      {delta < 0 ? '−' : delta > 0 ? '+' : ''}{fmt$(Math.abs(delta))} · {pct}%
                    </span>
                  </div>
                );
              })()}
              {trade.manual && (
                <>
                  <h4 style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: '16px 0 8px' }}>Note</h4>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                    This row has a <strong style={{ color: 'var(--warn-fg)' }}>manual override</strong> — the auto-rule (finalized → use finalized; no bid → carry-forward estimated) does not apply. The New Budget value was set directly by Sol Klein.
                  </div>
                </>
              )}
              <h4 style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', margin: '16px 0 8px' }}>Bid history</h4>
              <div style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', padding: '18px 0', textAlign: 'center', fontSize: 12 }}>
                Full bid history available in ClickUp
              </div>
              <div style={{ marginTop: 8 }}>
                <button style={{
                  width: '100%', height: 34, borderRadius: 'var(--border-radius-md)',
                  border: '0.5px solid var(--lib-black)', background: 'var(--lib-black)', color: '#fff',
                  fontSize: 12.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <i className="ti ti-external-link" style={{ fontSize: 13 }} /> Open in ClickUp
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// VIEWS
// ──────────────────────────────────────────────────────────────
function OverviewView({ onGoBrady }: { onGoBrady: () => void }) {
  const { project, portfolioProjects } = BUDGET_SAMPLE;
  const bs = computeStats(project.trades);
  const bDelta = bs.newv - bs.est;
  const bDp = bs.est > 0 ? (bDelta / bs.est * 100) : 0;

  let pfEst = bs.est;
  portfolioProjects.forEach((p, i) => {
    if (!p.real) pfEst += siblingEstM(i) * 1e6;
  });
  const pfDelta = bs.newv - bs.est;
  const pfDp = bs.est > 0 ? (pfDelta / bs.est * 100) : 0;

  const over = bs.newv > bs.est ? 1 : 0;
  const under = bs.newv < bs.est ? 1 : 0;

  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    background: 'var(--color-background-secondary)',
    padding: '10px 12px',
    fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--color-text-tertiary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap', textAlign: 'left',
  };

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: '1.25rem' }}>
        <KpiCard label="Total New Budget" value={fmt$(bs.newv)} sub="active job value · Brady" icon="ti-wallet" tone="good" />
        <KpiCard
          label="Δ vs Estimated"
          value={(bDelta < 0 ? '−' : bDelta > 0 ? '+' : '') + fmt$(Math.abs(bDelta))}
          sub={bDp.toFixed(1) + '% · Brady-anchored'}
          icon="ti-trending-down"
          tone="danger"
        />
        <KpiCard label="Projects over budget" value={String(over)} sub="New > Estimated" icon="ti-arrow-up-right" tone="amber" />
        <KpiCard label="Projects under budget" value={String(under)} sub="savings vs estimate" icon="ti-arrow-down-right" tone="good" />
        <KpiCard label="Trades awaiting bids" value={String(bs.eo)} sub="on Brady · 42 siblings pending sync" icon="ti-hourglass" tone="info" />
      </div>

      {/* Projects matrix */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '18px 20px',
        marginBottom: '1.25rem',
      }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-table" />
          Projects matrix
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
            click{' '}
            <button
              onClick={onGoBrady}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: 'inherit' }}
            >
              800 Brady
            </button>
            {' '}for the per-trade drill-in · ghost rows = pending ClickUp sync
          </span>
        </h2>
        <div style={{ maxHeight: 600, overflowY: 'auto', background: 'var(--color-background-primary)', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Project', 'Estimated', 'Committed', 'New Budget', 'Δ $', 'Δ %', '# trades finalized'].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i === 0 ? 'left' : i === 6 ? 'center' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Real row: 800 Brady */}
              <tr style={{ cursor: 'pointer' }} onClick={onGoBrady}>
                {[
                  <td key="name" style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, color: 'var(--lib-orange)' }}>800 Brady Ave</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Bronx, NY · Sol</span>
                    </div>
                  </td>,
                  <td key="est" style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt$(bs.est)}</td>,
                  <td key="fin" style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt$(bs.fin)}</td>,
                  <td key="new" style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt$(bs.newv)}</td>,
                  <td key="delta$" style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: bDelta < 0 ? 'var(--var-under)' : bDelta > 0 ? 'var(--var-over)' : undefined }}>
                    {(bDelta < 0 ? '−' : bDelta > 0 ? '+' : '')}{fmt$(Math.abs(bDelta))}
                  </td>,
                  <td key="deltaP" style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: bDelta < 0 ? 'var(--var-under)' : bDelta > 0 ? 'var(--var-over)' : undefined }}>
                    {bDp.toFixed(1)}%
                  </td>,
                  <td key="spark" style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'center' }}>
                    <SparkBar finalized={bs.withBids} total={bs.count - bs.na - bs.inc} />
                  </td>,
                ]}
              </tr>
              {/* Ghost rows */}
              {portfolioProjects.filter(p => !p.real).map((p, i) => {
                const estM = siblingEstM(i);
                return (
                  <tr key={p.name}>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                          padding: '1px 6px', borderRadius: 999,
                          background: 'var(--color-background-tertiary)', color: 'var(--color-text-tertiary)',
                          border: '1px solid var(--color-border-tertiary)',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          <i className="ti ti-cloud-off" style={{ fontSize: 9 }} /> pending sync
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{p.loc}</div>
                    </td>
                    {['$' + estM.toFixed(1) + 'M est', '—', '—', '—', '—'].map((v, ci) => (
                      <td key={ci} style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', color: 'var(--color-text-tertiary)', fontStyle: 'italic', opacity: 0.55, fontVariantNumeric: 'tabular-nums' }}>{v}</td>
                    ))}
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'center' }}>
                      <SparkBar ghost />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', fontWeight: 600 }}>
                  Portfolio total{' '}
                  <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)', fontSize: 11 }}>· est = Brady + ghosted siblings · committed/new = Brady only</span>
                </td>
                {[fmt$(pfEst), fmt$(bs.fin), fmt$(bs.newv)].map((v, i) => (
                  <td key={i} style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</td>
                ))}
                <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: pfDelta < 0 ? 'var(--var-under)' : pfDelta > 0 ? 'var(--var-over)' : undefined }}>
                  {(pfDelta < 0 ? '−' : pfDelta > 0 ? '+' : '')}{fmt$(Math.abs(pfDelta))}
                </td>
                <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {pfDp.toFixed(1)}%
                </td>
                <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                  1 real · 42 pending
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function DetailedView({
  onGoOverview,
  onTradeClick,
}: {
  onGoOverview: () => void;
  onTradeClick: (t: BudgetTrade) => void;
}) {
  const { project } = BUDGET_SAMPLE;
  const bs = computeStats(project.trades);
  const d = bs.newv - bs.est;
  const dp = bs.est > 0 ? (d / bs.est * 100) : 0;

  // "where budget moved"
  const movers = project.trades
    .filter(r => isMoney(r.est) && isMoney(r.fin))
    .map(r => ({ trade: r.trade, d: (r.fin as number) - (r.est as number) }));
  movers.sort((a, b) => a.d - b.d);
  const top5Under = movers.slice(0, 5);
  const top3Over = movers.filter(m => m.d > 0).slice(-3).reverse();

  const totDelta = bs.newv - bs.est;
  const totPct = bs.est > 0 ? (totDelta / bs.est * 100) : 0;

  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 3,
    background: 'var(--color-background-secondary)',
    padding: '10px 12px',
    fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--color-text-tertiary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onGoOverview} style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'inherit' }}>Portfolio</button>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, opacity: 0.6 }} />
        <span>800 Brady Ave · Budget</span>
      </div>

      {/* Project header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start',
        paddingBottom: 14, borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 14,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em', margin: '0 0 6px' }}>800 Brady Ave</h1>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--c-sol-bg)', color: 'var(--c-sol-dark)' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', color: 'var(--c-sol-dark)', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>SK</span>
              Sol Klein
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--info-bg)', color: 'var(--info-fg)' }}>
              <i className="ti ti-calculator" style={{ fontSize: 13 }} />Budgeting
            </span>
            <span><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: '-2px' }} /> Bronx, NY 10462</span>
            <span><i className="ti ti-id" style={{ fontSize: 13, verticalAlign: '-2px' }} /> 800-BRDY-2025</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ height: 32, padding: '0 13px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <i className="ti ti-folder" /> ClickUp folder
          </button>
          <button style={{ height: 32, padding: '0 13px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--lib-black)', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--lib-black)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            <i className="ti ti-external-link" /> Open in ClickUp
          </button>
        </div>
      </div>

      {/* 6-KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: '1.25rem' }}>
        <KpiCard label="Total Estimated" value={fmt$(bs.est)} sub="baseline · all trades" icon="ti-clipboard-list" />
        <KpiCard label="Lowest received" value={fmt$(bs.fin)} sub="finalized + lowest in hand" icon="ti-target" tone="info" />
        <KpiCard label="New Budget" value={fmt$(bs.newv)} sub="auto-rule + manual overrides" icon="ti-wallet" tone="good" />
        <KpiCard label="Δ vs Estimated" value={(d < 0 ? '−' : d > 0 ? '+' : '') + fmt$(Math.abs(d))} sub={dp.toFixed(1) + '% vs estimate'} icon="ti-arrow-bounce" tone="amber" />
        <KpiCard label="Trades with bids in" value={String(bs.withBids)} sub="have a Finalized/lowest" icon="ti-checks" />
        <KpiCard label="Estimate-only" value={String(bs.eo)} sub="no bids yet · carry-forward" icon="ti-hourglass-low" />
      </div>

      {/* Main content: table + side rail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14 }}>
        {/* Per-trade table */}
        <div style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '18px 20px',
        }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-table" /> Per-trade budget
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
              click a row → bid history drawer · &quot;Manual&quot; = auto-rule overridden
            </span>
          </h2>
          <div style={{ maxHeight: 680, overflowY: 'auto', background: 'var(--color-background-primary)', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
              <colgroup>
                <col />
                <col style={{ width: 140 }} /><col style={{ width: 140 }} /><col style={{ width: 140 }} />
                <col style={{ width: 180 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Hard cost</th>
                  <th style={{ ...th, textAlign: 'right' }}>Estimated Budget</th>
                  <th style={{ ...th, textAlign: 'right' }}>Finalized / lowest bid</th>
                  <th style={{ ...th, textAlign: 'right' }}>New Budget</th>
                  <th style={{ ...th, textAlign: 'center' }}>Variance vs Estimated</th>
                </tr>
              </thead>
              <tbody>
                {project.trades.map((r, idx) => (
                  <tr
                    key={idx}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onTradeClick(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', verticalAlign: 'middle', fontSize: 13, fontWeight: 500 }}>
                      {r.trade}
                      {r.manual && <ManualBadge />}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      <MoneyToken v={r.est} dim={!isMoney(r.est)} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      <MoneyToken v={r.fin} dim={!isMoney(r.fin)} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      <MoneyToken v={r.newv} bold dim={!isMoney(r.newv)} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', verticalAlign: 'middle' }}>
                      <VarBar r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', fontWeight: 600, fontSize: 13.5 }}>Total</td>
                  <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600 }}>{fmtFull$(bs.est)}</td>
                  <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600 }}>{fmtFull$(bs.fin)}</td>
                  <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600 }}>{fmtFull$(bs.newv)}</td>
                  <td style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderTop: '1.5px solid var(--color-border-secondary)', padding: '14px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13.5 }}>
                    <span style={{ color: totDelta < 0 ? 'var(--var-under)' : totDelta > 0 ? 'var(--var-over)' : 'var(--color-text-tertiary)', fontWeight: 600 }}>
                      {totDelta < 0 ? '−' : totDelta > 0 ? '+' : ''}{fmt$(Math.abs(totDelta))} · {totPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Side rail */}
        <div>
          <SideCard title="Where the budget moved" icon="ti-arrow-bounce">
            {top5Under.map(m => (
              <div key={m.trade} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', fontSize: 13, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-arrow-down" style={{ fontSize: 12, color: 'var(--var-under)' }} />
                  <span style={{ fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.trade}</span>
                </span>
                <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--var-under)' }}>−{fmt$(Math.abs(m.d))}</span>
              </div>
            ))}
            {top3Over.length > 0 && (
              <>
                <div style={{ height: 8 }} />
                <div style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 0 4px' }}>Over budget</div>
                {top3Over.map(m => (
                  <div key={m.trade} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', fontSize: 13, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="ti ti-arrow-up" style={{ fontSize: 12, color: 'var(--var-over)' }} />
                      <span style={{ fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.trade}</span>
                    </span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--var-over)' }}>+{fmt$(m.d)}</span>
                  </div>
                ))}
              </>
            )}
          </SideCard>

          <SideCard title="Row composition" icon="ti-tag">
            {[
              { label: 'Trades with bids in', val: bs.withBids },
              { label: 'Estimate-only', val: bs.eo },
              { label: '"Included"', val: bs.inc, icon: 'ti-package' },
              { label: '"NA"', val: bs.na, icon: 'ti-ban' },
              { label: 'Manual overrides', val: bs.manual, icon: 'ti-edit' },
            ].map(({ label, val, icon }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', fontSize: 13, borderTop: i === 0 ? 'none' : '0.5px solid var(--color-border-tertiary)' }}>
                <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {icon && <i className={`ti ${icon}`} style={{ fontSize: 11 }} />}
                  {label}
                </span>
                <span style={{ fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </SideCard>

          <SideCard title="New Budget rule" icon="ti-info-circle">
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              <div style={{ padding: '4px 0' }}><b style={{ color: 'var(--color-text-primary)' }}>Finalized exists</b> → New = Finalized</div>
              <div style={{ padding: '4px 0' }}><b style={{ color: 'var(--color-text-primary)' }}>No bid yet</b> → New = Estimated (carry-forward)</div>
              <div style={{ padding: '4px 0' }}><b style={{ color: 'var(--color-text-primary)' }}>Included / NA</b> → mirrors that token</div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 11.5 }}>
                3 documented exceptions — rule does NOT auto-apply: Structure, Site safety coordination, Lighting Material. Flagged with{' '}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999, background: 'var(--warn-bg)', color: 'var(--warn-fg)', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid rgba(186,117,23,0.35)' }}>
                  <i className="ti ti-edit" style={{ fontSize: 9 }} /> Manual
                </span>.
              </div>
            </div>
          </SideCard>
        </div>
      </div>
    </div>
  );
}

function MatrixView({ onGoDetailed }: { onGoDetailed: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 680, margin: '24px auto' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 999,
        background: 'var(--color-background-secondary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <i className="ti ti-table-off" style={{ fontSize: 22, color: 'var(--color-text-tertiary)' }} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500, justifyContent: 'center', display: 'block' }}>
        Matrix view lives on the Bidding dashboard
      </h2>
      <p style={{ margin: '0 auto', fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55, maxWidth: 480 }}>
        Budget has a single source of truth — the per-trade table in{' '}
        <button onClick={onGoDetailed} style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', padding: 0, fontSize: 12.5, fontFamily: 'inherit' }}>Detailed view</button>
        {' '}— so a separate matrix layout doesn&apos;t add a new angle. The Trade × Sub matrix with the 8-color status palette lives on the{' '}
        <Link href="/bidding" style={{ color: 'var(--color-text-info)' }}>Bidding dashboard</Link>.
      </p>
      <div style={{ display: 'inline-flex', gap: 8, marginTop: 18 }}>
        <button onClick={onGoDetailed} style={{ height: 32, padding: '0 13px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', fontSize: 12.5, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-list-details" /> Open Detailed view
        </button>
        <Link href="/bidding" style={{ height: 32, padding: '0 13px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--lib-black)', background: 'var(--lib-black)', color: '#fff', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <i className="ti ti-gavel" /> Switch to Bidding dashboard
        </Link>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// VarianceView
// ──────────────────────────────────────────────────────────────
function VarianceView({ onBack }: { onBack: () => void }) {
  const { project } = BUDGET_SAMPLE;
  const trades = project.trades;
  const [drawerTrade, setDrawerTrade] = useState<BudgetTrade | null>(null);
  const closeDrawer = useCallback(() => setDrawerTrade(null), []);

  // Partition trades
  const underTrades = trades
    .filter(r => isMoney(r.est) && isMoney(r.fin) && (r.fin as number) < (r.est as number))
    .map(r => ({ r, delta: (r.fin as number) - (r.est as number) }))
    .sort((a, b) => a.delta - b.delta);

  const overTrades = trades
    .filter(r => isMoney(r.est) && isMoney(r.fin) && (r.fin as number) > (r.est as number))
    .map(r => ({ r, delta: (r.fin as number) - (r.est as number) }))
    .sort((a, b) => b.delta - a.delta);

  const cfTrades = trades.filter(r => {
    if (isMoney(r.est) && isMoney(r.fin)) return false;
    return true;
  });

  // KPI computations
  const totalSaved = underTrades.reduce((s, x) => s + Math.abs(x.delta), 0);
  const totalOver = overTrades.reduce((s, x) => s + x.delta, 0);
  const bs = computeStats(trades);
  const netDelta = bs.newv - bs.est;
  const eoCount = bs.eo;

  const top5Under = underTrades.slice(0, 5);
  const top5Over = overTrades.slice(0, 5);

  // Max abs delta for bar scaling
  const allDeltas = [...underTrades.map(x => Math.abs(x.delta)), ...overTrades.map(x => x.delta)];
  const maxDelta = allDeltas.length > 0 ? Math.max(...allDeltas) : 1;

  function VarianceRow({ r, delta, side }: { r: BudgetTrade; delta: number; side: 'under' | 'over' }) {
    const pct = Math.min(48, (Math.abs(delta) / maxDelta) * 48);
    const absDelta = Math.abs(delta);
    const dPct = isMoney(r.est) && (r.est as number) > 0 ? (delta / (r.est as number) * 100) : 0;
    return (
      <div
        onClick={() => setDrawerTrade(r)}
        style={{
          display: 'grid', gridTemplateColumns: '220px 1fr 90px 50px',
          alignItems: 'center', padding: '7px 12px', cursor: 'pointer', gap: 8,
          borderBottom: '0.5px solid var(--color-border-tertiary)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.trade}
          {r.manual && <ManualBadge />}
        </div>
        {/* bar */}
        <div style={{ position: 'relative', height: 14 }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--color-border-secondary)' }} />
          {side === 'under' && (
            <div style={{ position: 'absolute', top: 2, bottom: 2, right: '50%', width: `${pct}%`, borderRadius: 2, background: 'var(--var-under)' }} />
          )}
          {side === 'over' && (
            <div style={{ position: 'absolute', top: 2, bottom: 2, left: '50%', width: `${pct}%`, borderRadius: 2, background: 'var(--var-over)' }} />
          )}
        </div>
        <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: side === 'under' ? 'var(--var-under)' : 'var(--var-over)', fontWeight: 500 }}>
          {side === 'under' ? '−' : '+'}{fmt$(absDelta)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {Math.abs(dPct).toFixed(0)}%
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'inherit' }}>Portfolio</button>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, opacity: 0.6 }} />
        <span>800 Brady Ave · Budget</span>
      </div>

      <ProjectHeroCard onBack={onBack} />

      {/* 4-KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.25rem' }}>
        <KpiCard label="Total saved vs est" value={fmt$(totalSaved)} sub="sum of under-budget trades" icon="ti-trending-down" tone="good" />
        <KpiCard label="Total over vs est" value={fmt$(totalOver)} sub="sum of over-budget trades" icon="ti-trending-up" tone="danger" />
        <KpiCard label="Net Δ vs estimated" value={(netDelta < 0 ? '−' : netDelta > 0 ? '+' : '') + fmt$(Math.abs(netDelta))} sub="new budget vs estimate total" icon="ti-arrow-bounce" tone="amber" />
        <KpiCard label="Estimate-only trades" value={String(eoCount)} sub="no bids yet" icon="ti-hourglass" tone="info" />
      </div>

      {/* Top 5 cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: '1.25rem' }}>
        {/* Top 5 savings */}
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderLeft: '3px solid var(--var-under)', borderRadius: 'var(--border-radius-lg)', padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--var-under)', marginBottom: 2 }}>Top 5 Savings</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>total: −{fmt$(totalSaved)}</div>
          {top5Under.map((x, i) => {
            const dPct = isMoney(x.r.est) && (x.r.est as number) > 0 ? Math.abs(x.delta) / (x.r.est as number) * 100 : 0;
            return (
              <div key={x.r.trade} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 12.5 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', minWidth: 16, textAlign: 'right' }}>#{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.r.trade}</span>
                <span style={{ color: 'var(--var-under)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>−{fmt$(Math.abs(x.delta))}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{dPct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
        {/* Top 5 overruns */}
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderLeft: '3px solid var(--var-over)', borderRadius: 'var(--border-radius-lg)', padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--var-over)', marginBottom: 2 }}>Top 5 Overruns</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>total: +{fmt$(totalOver)}</div>
          {top5Over.map((x, i) => {
            const dPct = isMoney(x.r.est) && (x.r.est as number) > 0 ? x.delta / (x.r.est as number) * 100 : 0;
            return (
              <div key={x.r.trade} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 12.5 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', minWidth: 16, textAlign: 'right' }}>#{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.r.trade}</span>
                <span style={{ color: 'var(--var-over)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>+{fmt$(x.delta)}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{dPct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full trade variance table */}
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '18px 20px', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
            All {trades.length} trades · ranked by $ variance
          </h2>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)' }}>bar width = % delta vs estimated · click row → drawer</span>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--color-text-secondary)', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--var-under)', display: 'inline-block' }} /> Under budget</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--var-over)', display: 'inline-block' }} /> Over budget</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--info-bg)', border: '0.5px solid var(--info-fg)', display: 'inline-block' }} /> Estimate-only</span>
        </div>

        {/* Under section */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--var-under)', padding: '8px 12px 4px', marginTop: 4 }}>
          Under budget · sorted by $ saved · {underTrades.length} trades
        </div>
        {underTrades.map(x => <VarianceRow key={x.r.trade} r={x.r} delta={x.delta} side="under" />)}

        {/* Carry-forward / middle section */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', padding: '12px 12px 4px', marginTop: 4 }}>
          Carry-forward · included · NA · {cfTrades.length} trades
        </div>
        {cfTrades.map(r => {
          let pill: ReactNode = null;
          if (r.est === 'INC' || r.fin === 'INC' || r.newv === 'INC') {
            pill = <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', color: 'var(--color-text-secondary)' }}>Included</span>;
          } else if (r.newv === 'NA') {
            pill = <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, border: '0.5px dashed var(--color-border-secondary)', color: 'var(--color-text-tertiary)' }}>NA</span>;
          } else {
            pill = <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'var(--info-bg)', color: 'var(--info-fg)', border: '0.5px solid var(--info-fg)' }}>estimate-only · no bid yet</span>;
          }
          return (
            <div
              key={r.trade}
              onClick={() => setDrawerTrade(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer', fontSize: 12.5 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{r.trade}</span>
              {pill}
              {isMoney(r.est) && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>est {fmt$(r.est)} → carries forward</span>}
              {r.manual && <ManualBadge />}
            </div>
          );
        })}

        {/* Over section */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--var-over)', padding: '12px 12px 4px', marginTop: 4 }}>
          Over budget · sorted by $ overrun · {overTrades.length} trades
        </div>
        {overTrades.map(x => <VarianceRow key={x.r.trade} r={x.r} delta={x.delta} side="over" />)}
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: 1.7 }}>
        Live from ClickUp · 60-second cache · click any row to see bid history
        <span style={{ display: 'block' }}>Sort order: biggest savings on top → carry-forward / Included / NA in the middle → biggest overruns at bottom</span>
      </div>

      <Drawer open={drawerTrade !== null} trade={drawerTrade} onClose={closeDrawer} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// TreemapView
// ──────────────────────────────────────────────────────────────
function TreemapView({ onBack }: { onBack: () => void }) {
  const { project } = BUDGET_SAMPLE;
  const trades = project.trades;
  const bs = computeStats(trades);

  // Numeric newv trades
  const numericTrades = trades.filter(r => isMoney(r.newv)).map(r => ({ r, val: r.newv as number }));
  numericTrades.sort((a, b) => b.val - a.val);
  const total = numericTrades.reduce((s, x) => s + x.val, 0);
  const nonNumericCount = trades.filter(r => !isMoney(r.newv)).length;

  const biggestTile = numericTrades[0];
  const top5Sum = numericTrades.slice(0, 5).reduce((s, x) => s + x.val, 0);
  const top5Pct = total > 0 ? (top5Sum / total * 100) : 0;

  function deltaPct(r: BudgetTrade): number | null {
    if (!isMoney(r.est) || !isMoney(r.newv)) return null;
    if ((r.est as number) === 0) return null;
    return ((r.newv as number) - (r.est as number)) / (r.est as number) * 100;
  }

  function tileColor(r: BudgetTrade): string {
    if (r.est === 'INC' || r.fin === 'INC' || r.newv === 'INC') {
      return 'repeating-linear-gradient(45deg, var(--color-background-secondary) 0px, var(--color-background-secondary) 4px, var(--color-border-secondary) 4px, var(--color-border-secondary) 6px)';
    }
    if (!isMoney(r.est)) return 'var(--info-bg)';
    const dp = deltaPct(r);
    if (dp === null) return 'var(--info-bg)';
    if (dp <= -30) return '#1a4510';
    if (dp <= -10) return 'var(--good-bg)';
    if (dp < 10) return 'var(--color-background-secondary)';
    if (dp < 30) return '#fde8e8';
    return '#7f1d1d';
  }

  // Variance bucket counts
  const buckets = [
    { label: 'Saved ≥30%', count: 0, color: '#1a4510' },
    { label: 'Saved 10–30%', count: 0, color: 'var(--good-bg)' },
    { label: 'Saved 1–10%', count: 0, color: '#d1fae5' },
    { label: 'On estimate ±1%', count: 0, color: 'var(--color-background-secondary)' },
    { label: 'Over 1–10%', count: 0, color: '#fee2e2' },
    { label: 'Over 10–30%', count: 0, color: '#fca5a5' },
    { label: 'Over ≥30%', count: 0, color: '#7f1d1d' },
    { label: 'Estimate-only', count: 0, color: 'var(--info-bg)' },
    { label: 'Included', count: 0, color: 'var(--color-background-secondary)' },
    { label: 'NA', count: 0, color: 'transparent' },
  ];
  for (const r of trades) {
    if (r.est === 'INC' || r.fin === 'INC' || r.newv === 'INC') { buckets[8].count++; continue; }
    if (r.newv === 'NA' || r.est === 'NA') { buckets[9].count++; continue; }
    const dp = deltaPct(r);
    if (dp === null) { buckets[7].count++; continue; }
    if (dp <= -30) buckets[0].count++;
    else if (dp <= -10) buckets[1].count++;
    else if (dp < -1) buckets[2].count++;
    else if (dp <= 1) buckets[3].count++;
    else if (dp < 10) buckets[4].count++;
    else if (dp < 30) buckets[5].count++;
    else buckets[6].count++;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'inherit' }}>Portfolio</button>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, opacity: 0.6 }} />
        <span>800 Brady Ave · Budget</span>
      </div>

      <ProjectHeroCard onBack={onBack} />

      {/* 4-KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.25rem' }}>
        <KpiCard label="New Budget total" value={fmt$(bs.newv)} sub="sum of all numeric newv" icon="ti-wallet" tone="good" />
        <KpiCard label="Biggest single tile" value={biggestTile ? biggestTile.r.trade.slice(0, 14) : '—'} sub={biggestTile ? fmt$(biggestTile.val) : '—'} icon="ti-maximize" />
        <KpiCard label="Top 5 = % of total" value={top5Pct.toFixed(0) + '%'} sub="sum of top 5 newv / total" icon="ti-chart-pie" tone="amber" />
        <KpiCard label="Non-numeric tiles" value={String(nonNumericCount)} sub="INC + NA + no newv" icon="ti-category-2" tone="info" />
      </div>

      {/* Treemap section */}
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '18px 20px', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Spend treemap · 800 Brady</h2>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>area = New Budget · color = % variance vs estimated · hover for details</span>
        </div>
        {/* Color legend */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontSize: 10.5, color: 'var(--color-text-secondary)', alignItems: 'center' }}>
          {[
            { label: 'Saved ≥30%', color: '#1a4510' },
            { label: 'Saved 10–30%', color: 'var(--good-bg)' },
            { label: 'On estimate', color: 'var(--color-background-tertiary)' },
            { label: 'Over 10–30%', color: '#fca5a5' },
            { label: 'Over ≥30%', color: '#7f1d1d' },
            { label: 'Estimate-only', color: 'var(--info-bg)' },
          ].map(b => (
            <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: b.color, border: '0.5px solid rgba(0,0,0,0.1)', display: 'inline-block', flexShrink: 0 }} />
              {b.label}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg, #ddd 0px, #ddd 3px, #fff 3px, #fff 5px)', display: 'inline-block', flexShrink: 0 }} />
            Included/rolled-up
          </span>
        </div>

        {/* Treemap tiles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: 'var(--color-background-secondary)', padding: 2, borderRadius: 6 }}>
          {numericTrades.map(({ r, val }) => {
            const flexBasis = Math.max(4, (val / total) * 100);
            const isLarge = flexBasis > 8;
            const dp = deltaPct(r);
            const dpStr = dp !== null ? (dp < 0 ? `−${Math.abs(dp).toFixed(1)}%` : `+${dp.toFixed(1)}%`) : 'est-only';
            const bg = tileColor(r);
            const isGradient = bg.startsWith('repeating');
            return (
              <div
                key={r.trade}
                title={`${r.trade}\nNew Budget: ${fmt$(val)}\n${dp !== null ? `Δ vs est: ${dpStr}` : 'Estimate-only'}`}
                style={{
                  flexBasis: `max(4%, ${flexBasis}%)`,
                  flexGrow: val,
                  flexShrink: 0,
                  minHeight: isLarge ? 80 : 40,
                  background: isGradient ? undefined : bg,
                  backgroundImage: isGradient ? bg : undefined,
                  borderRadius: 4,
                  padding: isLarge ? '8px 10px' : '4px 6px',
                  overflow: 'hidden',
                  cursor: 'default',
                  border: '0.5px solid rgba(0,0,0,0.07)',
                }}
              >
                <div style={{ fontSize: isLarge ? 11.5 : 9.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: bg === '#1a4510' || bg === '#7f1d1d' ? '#fff' : 'var(--color-text-primary)' }}>
                  {r.trade}
                </div>
                {isLarge && (
                  <div style={{ fontSize: 10.5, marginTop: 2, color: bg === '#1a4510' || bg === '#7f1d1d' ? 'rgba(255,255,255,0.8)' : 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt$(val)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 8 by $ value */}
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '18px 20px', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500 }}>Top 8 by $ value</h2>
        {numericTrades.slice(0, 8).map((x, i) => {
          const pctOfTotal = total > 0 ? (x.val / total * 100) : 0;
          const dp = deltaPct(x.r);
          return (
            <div key={x.r.trade} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 12.5 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', minWidth: 18, textAlign: 'right' }}>#{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.r.trade}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt$(x.val)}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>{pctOfTotal.toFixed(1)}%</span>
              {dp !== null && (
                <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: dp < 0 ? 'var(--var-under)' : dp > 0 ? 'var(--var-over)' : 'var(--color-text-tertiary)', minWidth: 48, textAlign: 'right' }}>
                  {dp < 0 ? '−' : dp > 0 ? '+' : ''}{Math.abs(dp).toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Variance buckets summary */}
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '18px 20px', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500 }}>Variance buckets</h2>
        {buckets.map(b => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: b.color, border: '0.5px solid rgba(0,0,0,0.1)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{b.label}</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{b.count}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: 1.7 }}>
        Live from ClickUp · 60-second cache
        <span style={{ display: 'block' }}>Tile area is proportional to New Budget value; largest tiles anchored top-left</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// CategoriesView
// ──────────────────────────────────────────────────────────────
const WORK_PACKAGES = [
  {
    id: 'earthwork', icon: 'ti-bulldozer', label: 'Earthwork & Structure',
    caption: 'foundation · superstructure · soil management · steel · concrete inspection',
    trades: ['Foundation', 'Structure', 'Soil · Trucking', 'Steel', 'Concrete LAB inspector', 'Monitoring · vibration'],
  },
  {
    id: 'mep', icon: 'ti-bolt', label: 'MEP',
    caption: 'plumbing · sprinkler · electric · HVAC · fire alarm · low voltage · watermain',
    trades: ['Plumbing · sprinkler', 'Pipe insualtion', 'Electric', 'Lighting Material', 'Fire Alarm', 'Low Voltage', 'Watermain', 'HVAC', 'Ptac units', 'Fire Stopping'],
  },
  {
    id: 'envelope', icon: 'ti-building-arch', label: 'Envelope & Cladding',
    caption: 'framing · drywall · windows · doors · roofing · stucco',
    trades: ['Framing Exterior / Interior', 'Sheetrock', 'Tape / paint', 'Trimming · Doors', 'Insulation Exterior walls / interior', 'Windows', 'Main doors', 'Stucco', 'Roofing'],
  },
  {
    id: 'vertical', icon: 'ti-elevator', label: 'Vertical Transport & Equipment',
    caption: 'elevator · hoist · scaffold · chutes · garage door',
    trades: ['Elevator', 'Hoist', 'Scaffold / Shed', 'Chutes / Compactors', 'Garage Door'],
  },
  {
    id: 'finishes', icon: 'ti-paint', label: 'Finishes & Fixtures',
    caption: 'tiles · plumbing fixtures · bathtubs · kitchens · appliances · BPP',
    trades: ['Tiles', 'Tiles Installation', 'Plumbing Fixtures', 'Bathtubs', 'Kitchens', 'Apt appliances', 'BPP'],
  },
  {
    id: 'site', icon: 'ti-fence', label: 'Site & Logistics',
    caption: 'security · fence · garbage · parking · bike room · green roof',
    trades: ['Live Security', 'Fence', 'Garbage Removal', 'Parking stops and marking', 'Bike room', 'Green roof'],
  },
  {
    id: 'safety', icon: 'ti-shield', label: 'Safety & Inspections',
    caption: 'superintendent · site safety · special inspector · surveyor · DOT · bathrooms · fire extinguishers',
    trades: ['Superintendent', 'Site safety coordination', 'Site Safety Plan', 'Special inspector', 'Survey', 'DOT meeting', 'Bathrooms', 'fire extignitures'],
  },
  {
    id: 'fees', icon: 'ti-receipt', label: 'Fees & Allowances',
    caption: 'GC fee · signs · mailbox',
    trades: ['GC Fee', 'Signs', 'Mailbox'],
  },
];

function CategoriesView({ onBack }: { onBack: () => void }) {
  const { project } = BUDGET_SAMPLE;
  const trades = project.trades;
  const [openPkg, setOpenPkg] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  const tradeByName = new Map(trades.map(r => [r.trade, r]));

  // Build package stats
  type PkgStats = {
    id: string; icon: string; label: string; caption: string;
    pkgTrades: BudgetTrade[];
    estTotal: number; newvTotal: number;
    under: number; over: number; eo: number; inc: number; na: number;
  };

  const pkgStats: PkgStats[] = WORK_PACKAGES.map(wp => {
    const pkgTrades = wp.trades.map(name => tradeByName.get(name)).filter(Boolean) as BudgetTrade[];
    let estTotal = 0, newvTotal = 0;
    let under = 0, over = 0, eo = 0, inc = 0, na = 0;
    for (const r of pkgTrades) {
      if (isMoney(r.est)) estTotal += r.est;
      if (isMoney(r.newv)) newvTotal += r.newv;
      if (r.est === 'INC' || r.fin === 'INC' || r.newv === 'INC') inc++;
      else if (r.newv === 'NA' || r.est === 'NA') na++;
      else if (isMoney(r.est) && isMoney(r.newv)) {
        if ((r.newv as number) < (r.est as number)) under++;
        else if ((r.newv as number) > (r.est as number)) over++;
      } else eo++;
    }
    return { id: wp.id, icon: wp.icon, label: wp.label, caption: wp.caption, pkgTrades, estTotal, newvTotal, under, over, eo, inc, na };
  });

  // Sort by newvTotal desc
  pkgStats.sort((a, b) => b.newvTotal - a.newvTotal);

  const maxEstTotal = Math.max(...pkgStats.map(p => p.estTotal), 1);

  const bs = computeStats(trades);
  const netDelta = bs.newv - bs.est;
  const netPct = bs.est > 0 ? (netDelta / bs.est * 100) : 0;

  function togglePkg(id: string) {
    if (allOpen) { setAllOpen(false); setOpenPkg(id); return; }
    setOpenPkg(prev => prev === id ? null : id);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'inherit' }}>Portfolio</button>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, opacity: 0.6 }} />
        <span>800 Brady Ave · Budget</span>
      </div>

      <ProjectHeroCard onBack={onBack} />

      {/* 3-step KPI flow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'TOTAL ESTIMATED', value: fmt$(bs.est), sub: 'baseline · all numeric trades', tone: 'default' as Tone },
          null,
          { label: 'NEW BUDGET', value: fmt$(bs.newv), sub: 'auto-rule + manual overrides', tone: 'good' as Tone },
          null,
          { label: 'NET Δ VS ESTIMATED', value: (netDelta < 0 ? '−' : netDelta > 0 ? '+' : '') + fmt$(Math.abs(netDelta)), sub: netPct.toFixed(1) + '% vs estimated', tone: (netDelta < 0 ? 'good' : netDelta > 0 ? 'danger' : 'default') as Tone },
        ].map((item, i) => {
          if (item === null) return <div key={i} style={{ fontSize: 20, color: 'var(--color-text-tertiary)', padding: '0 10px' }}>→</div>;
          const { v: vColor } = toneColors[item.tone];
          return (
            <div key={i} style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '12px 16px', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 500, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em', color: vColor }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{item.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => { setAllOpen(true); setOpenPkg(null); }}
          style={{ height: 28, padding: '0 11px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', fontSize: 12, background: 'var(--color-background-primary)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-primary)' }}
        >
          Expand all
        </button>
        <button
          onClick={() => { setAllOpen(false); setOpenPkg(null); }}
          style={{ height: 28, padding: '0 11px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', fontSize: 12, background: 'var(--color-background-primary)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-primary)' }}
        >
          Collapse all
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)' }}>8 work-packages · sorted by New Budget desc</span>
      </div>

      {/* Package cards */}
      {pkgStats.map(pkg => {
        const isOpen = allOpen || openPkg === pkg.id;
        const delta = pkg.newvTotal - pkg.estTotal;
        const deltaPctVal = pkg.estTotal > 0 ? (delta / pkg.estTotal * 100) : 0;
        const estBarW = pkg.estTotal > 0 ? (pkg.estTotal / maxEstTotal * 100) : 0;
        const newvBarW = pkg.newvTotal > 0 ? (pkg.newvTotal / maxEstTotal * 100) : 0;
        const barColor = delta < 0 ? 'var(--var-under)' : delta > 0 ? 'var(--var-over)' : 'var(--color-border-secondary)';

        return (
          <div key={pkg.id} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 18px', marginBottom: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <i className={`ti ${pkg.icon}`} style={{ fontSize: 16, marginTop: 1, color: 'var(--color-text-secondary)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{pkg.label}</span>
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', color: 'var(--color-text-tertiary)' }}>{pkg.pkgTrades.length} trades</span>
                  {delta !== 0 && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: delta < 0 ? 'var(--good-bg)' : 'var(--danger-bg, #fde8e8)', color: delta < 0 ? 'var(--var-under)' : 'var(--var-over)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {delta < 0 ? '↘ −' : '↗ +'}{fmt$(Math.abs(delta))} · {Math.abs(deltaPctVal).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{pkg.caption}</div>
              </div>
            </div>

            {/* Bars */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', minWidth: 80 }}>ESTIMATED</span>
                <div style={{ flex: 1, height: 6, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${estBarW}%`, height: '100%', background: 'var(--color-border-secondary)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{fmt$(pkg.estTotal)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', minWidth: 80 }}>NEW BUDGET</span>
                <div style={{ flex: 1, height: 6, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${newvBarW}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right', color: 'var(--color-text-primary)', fontWeight: 600 }}>{fmt$(pkg.newvTotal)}</span>
              </div>
            </div>

            {/* Count line */}
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
              {pkg.under} under · {pkg.over} over · {pkg.eo} estimate-only · {pkg.inc} Included · {pkg.na} NA
            </div>

            {/* Toggle */}
            <button
              onClick={() => togglePkg(pkg.id)}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 11.5, color: 'var(--color-text-info)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {isOpen ? `Hide ↑` : `Show ${pkg.pkgTrades.length} trades ↓`}
            </button>

            {/* Expanded trade list */}
            {isOpen && (
              <div style={{ marginTop: 10, borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 8 }}>
                {pkg.pkgTrades.map(r => (
                  <div key={r.trade} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 120px', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>
                      {r.trade}
                      {r.manual && <ManualBadge />}
                    </span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><MoneyToken v={r.est} dim={!isMoney(r.est)} /></span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><MoneyToken v={r.newv} bold dim={!isMoney(r.newv)} /></span>
                    <VarBar r={r} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: 1.7, marginTop: 8 }}>
        Live from ClickUp · 60-second cache · click any category to expand its trade list
        <span style={{ display: 'block' }}>Work-package mapping is heuristic — Sol can re-map a trade in ClickUp via the &apos;Cost Package&apos; custom field</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
type BudgetMode = 'table' | 'variance' | 'treemap' | 'categories';
type BudgetTableView = 'overview' | 'detailed' | 'matrix';

export function BudgetDashboard() {
  const [mode, setMode] = useState<BudgetMode>('table');
  const [tableView, setTableView] = useState<BudgetTableView>('overview');
  const [drawerTrade, setDrawerTrade] = useState<BudgetTrade | null>(null);
  const [search, setSearch] = useState('');
  const closeDrawer = useCallback(() => setDrawerTrade(null), []);

  const titleMap: Record<BudgetMode, string> = {
    table: 'Budget Dashboard',
    variance: 'Budget · Variance Ranking',
    treemap: 'Budget · Spend Treemap',
    categories: 'Budget · Category Rollup',
  };

  const subtitleMap: Record<BudgetMode, string> = {
    table: '43 active projects · live from ClickUp',
    variance: `800 Brady · ${BUDGET_SAMPLE.project.trades.length} trades · sorted by $ delta`,
    treemap: `800 Brady · ${BUDGET_SAMPLE.project.trades.length} trades · area = New Budget · color = Δ vs estimated`,
    categories: `800 Brady · ${BUDGET_SAMPLE.project.trades.length} trades grouped into 8 work-packages`,
  };

  const MODE_TABS: { id: BudgetMode; icon: string; label: string }[] = [
    { id: 'table',      icon: 'ti-grid-dots',   label: 'Table' },
    { id: 'variance',   icon: 'ti-chart-bar',   label: 'Variance' },
    { id: 'treemap',    icon: 'ti-layout-grid', label: 'Treemap' },
    { id: 'categories', icon: 'ti-list-tree',   label: 'Categories' },
  ];

  const TABLE_TABS: { id: BudgetTableView; icon: string; label: string }[] = [
    { id: 'overview', icon: 'ti-grid-dots',    label: 'Overview' },
    { id: 'detailed', icon: 'ti-list-details', label: 'Detailed' },
    { id: 'matrix',   icon: 'ti-table',        label: 'Matrix' },
  ];

  return (
    <div className="dashboard-shell">
      <LogoHeader
        title={titleMap[mode]}
        subtitleOverride={subtitleMap[mode]}
        syncedAt={BUDGET_SAMPLE.syncedAt}
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 8, fontSize: 13, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder={mode === 'table' ? 'Search projects, trades…' : 'Search trades…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              height: 32, paddingLeft: 26, paddingRight: 8,
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit', fontSize: 13, width: 200, outline: 'none',
            }}
          />
        </div>

        {/* Portfolio dropdown */}
        <select style={{ height: 32, padding: '0 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontFamily: 'inherit', fontSize: 13, minWidth: 200, fontWeight: 500 }} defaultValue="__all">
          <option value="__all">All projects (43)</option>
          <option value="800brady">★ 800 Brady Ave</option>
        </select>

        {/* Primary mode tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
          {MODE_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              style={{
                padding: '6px 14px', fontSize: 13, borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer', border: mode === tab.id ? '0.5px solid var(--color-border-secondary)' : '0.5px solid transparent',
                background: mode === tab.id ? 'var(--color-background-primary)' : 'transparent',
                color: mode === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
                fontWeight: mode === tab.id ? 500 : 400,
              }}
            >
              <i className={`ti ${tab.icon}`} style={{ fontSize: 14 }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Size tabs — only in Table mode */}
        {mode === 'table' && (
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', marginLeft: 'auto' }}>
            {TABLE_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTableView(tab.id)}
                style={{
                  padding: '6px 14px', fontSize: 13, borderRadius: 'var(--border-radius-md)',
                  cursor: 'pointer', border: tableView === tab.id ? '0.5px solid var(--color-border-secondary)' : '0.5px solid transparent',
                  background: tableView === tab.id ? 'var(--color-background-primary)' : 'transparent',
                  color: tableView === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontWeight: tableView === tab.id ? 500 : 400,
                }}
              >
                <i className={`ti ${tab.icon}`} style={{ fontSize: 14 }} />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode content */}
      {mode === 'table' && tableView === 'overview' && <OverviewView onGoBrady={() => setTableView('detailed')} />}
      {mode === 'table' && tableView === 'detailed' && <DetailedView onGoOverview={() => setTableView('overview')} onTradeClick={setDrawerTrade} />}
      {mode === 'table' && tableView === 'matrix' && <MatrixView onGoDetailed={() => setTableView('detailed')} />}
      {mode === 'variance'   && <VarianceView   onBack={() => setMode('table')} />}
      {mode === 'treemap'    && <TreemapView    onBack={() => setMode('table')} />}
      {mode === 'categories' && <CategoriesView onBack={() => setMode('table')} />}

      {/* Footer */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '14px 0 6px', fontSize: 11.5, color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
        Live from ClickUp · 60-second cache · click any trade row to open in ClickUp
        <span style={{ display: 'block', marginTop: 4, fontSize: 11 }}>
          Variance bar = New − Estimated · &quot;Manual&quot; = auto-rule overridden
        </span>
      </div>

      <Drawer open={drawerTrade !== null} trade={drawerTrade} onClose={closeDrawer} />
    </div>
  );
}
