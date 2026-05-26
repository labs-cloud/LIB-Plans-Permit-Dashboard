'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogoHeader } from '@/components/LogoHeader';
import type {
  BudgetTrade,
  BudgetPayload,
  BudgetPortfolioPayload,
  BudgetProject,
  MoneyVal,
} from '@/lib/budget-types';

// ──────────────────────────────────────────────────────────────
// Data context (per-project mode)
// ──────────────────────────────────────────────────────────────
const BudgetCtx = createContext<BudgetPayload | null>(null);

function useBudget(): BudgetPayload {
  const ctx = useContext(BudgetCtx);
  if (!ctx) throw new Error('useBudget must be used inside BudgetDashboard');
  return ctx;
}

async function fetcher(url: string): Promise<BudgetPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json() as Promise<BudgetPayload>;
}

async function portfolioFetcher(url: string): Promise<BudgetPortfolioPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json() as Promise<BudgetPortfolioPayload>;
}

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
// PortfolioBudgetView — Trade × Project matrix
// ──────────────────────────────────────────────────────────────
function PortfolioBudgetView({
  portfolioData,
  onNavigateToProject,
  search,
}: {
  portfolioData: BudgetPortfolioPayload;
  onNavigateToProject: (id: string) => void;
  search: string;
}) {
  const projects = portfolioData.projects;

  const projectTradeMap = useMemo(() => {
    const map = new Map<string, Map<string, BudgetTrade>>();
    for (const proj of projects) {
      const tm = new Map<string, BudgetTrade>();
      for (const t of proj.trades) tm.set(t.trade, t);
      map.set(proj.name, tm);
    }
    return map;
  }, [projects]);

  const allTradeNames = useMemo(() => {
    const names = new Set<string>();
    for (const [, tm] of projectTradeMap) for (const n of tm.keys()) names.add(n);
    const sorted = [...names].sort();
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((n) => n.toLowerCase().includes(q));
  }, [projectTradeMap, search]);

  // Per-project summary stats for the header
  const projectStats = useMemo(() => {
    const stats = new Map<string, ReturnType<typeof computeStats>>();
    for (const proj of projects) {
      stats.set(proj.name, computeStats(proj.trades));
    }
    return stats;
  }, [projects]);

  const thStyle: React.CSSProperties = {
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
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '18px 20px',
    }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="ti ti-table" />
        Portfolio budget matrix
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
          click a project column header to view its full budget detail
        </span>
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <colgroup>
            <col style={{ minWidth: 200 }} />
            {projects.map((_, i) => (
              <col key={i} style={{ minWidth: 130 }} />
            ))}
          </colgroup>
          <thead>
            {/* Project name row — clickable */}
            <tr>
              <th style={thStyle}>Trade</th>
              {projects.map((proj) => {
                const ps = projectStats.get(proj.name);
                return (
                  <th
                    key={proj.name}
                    title={`View ${proj.name} budget`}
                    onClick={() => onNavigateToProject(proj.name)}
                    style={{
                      textAlign: 'center',
                      padding: '7px 8px',
                      fontSize: 10,
                      color: 'var(--color-text-primary)',
                      fontWeight: 600,
                      background: 'var(--color-background-secondary)',
                      border: '0.5px solid var(--color-border-tertiary)',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      maxWidth: 130,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{proj.name}</div>
                    {ps && (
                      <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {fmt$(ps.newv)}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allTradeNames.length === 0 ? (
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
                  {search ? 'No trades match your search.' : 'No budget data yet.'}
                </td>
              </tr>
            ) : (
              allTradeNames.map((tradeName, ti) => (
                <tr key={ti}>
                  <td
                    style={{
                      padding: '7px 12px',
                      border: '0.5px solid var(--color-border-tertiary)',
                      fontWeight: 500,
                      background: 'var(--color-background-primary)',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      fontSize: 12.5,
                    }}
                  >
                    {tradeName}
                  </td>
                  {projects.map((proj) => {
                    const trade = projectTradeMap.get(proj.name)?.get(tradeName);
                    if (!trade) {
                      return (
                        <td
                          key={proj.name}
                          style={{
                            padding: '6px 8px',
                            border: '0.5px solid var(--color-border-tertiary)',
                            textAlign: 'center',
                            color: 'var(--color-text-tertiary)',
                            fontSize: 11,
                          }}
                        >
                          —
                        </td>
                      );
                    }

                    // Determine cell coloring based on variance
                    let bg: string | undefined;
                    let textColor: string | undefined;
                    if (isMoney(trade.newv) && isMoney(trade.est) && trade.est > 0) {
                      if ((trade.newv as number) < (trade.est as number)) {
                        bg = '#e8f5e9';
                        textColor = '#1F7A38';
                      } else if ((trade.newv as number) > (trade.est as number)) {
                        bg = '#fdecea';
                        textColor = '#A82828';
                      }
                    }

                    return (
                      <td
                        key={proj.name}
                        style={{
                          padding: '6px 8px',
                          border: '0.5px solid var(--color-border-tertiary)',
                          textAlign: 'right',
                          background: bg,
                          color: textColor ?? 'var(--color-text-primary)',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 12,
                          fontWeight: isMoney(trade.newv) ? 500 : 400,
                        }}
                      >
                        {fmt$(trade.newv)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// DetailedView
// ──────────────────────────────────────────────────────────────
function DetailedView({
  onGoOverview,
  onTradeClick,
}: {
  onGoOverview: () => void;
  onTradeClick: (t: BudgetTrade) => void;
}) {
  const { project } = useBudget();
  const bs = computeStats(project.trades);
  const d = bs.newv - bs.est;
  const dp = bs.est > 0 ? (d / bs.est * 100) : 0;
  const [shareCopied, setShareCopied] = useState(false);

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

  function handlePrint() {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const delta = bs.newv - bs.est;
    const deltaPct = bs.est > 0 ? (delta / bs.est * 100) : 0;
    const fmtNum = (v: MoneyVal): string => {
      if (v === null || v === undefined) return '–';
      if (v === 'INC') return 'Included';
      if (v === 'NA') return 'NA';
      if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
      if (Math.abs(v) >= 1e4) return '$' + (v / 1e3).toFixed(0) + 'k';
      return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };
    const fmtFull = (v: number): string =>
      '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rows = project.trades.map((r, ti) => {
      const rowBg = ti % 2 === 0 ? '#fff' : '#fafaf8';
      const rd = (isMoney(r.newv) && isMoney(r.est)) ? (r.newv - r.est) : null;
      const rdp = (rd !== null && isMoney(r.est) && r.est > 0) ? (rd / r.est * 100) : null;
      const varColor = rd === null ? '#aaa' : rd < 0 ? '#1F7A38' : rd > 0 ? '#A82828' : '#555';
      const varText = rd === null ? '–'
        : (rd < 0 ? '−' : rd > 0 ? '+' : '') + fmtNum(Math.abs(rd))
          + (rdp !== null ? ` (${rdp < 0 ? '−' : '+'}${Math.abs(rdp).toFixed(1)}%)` : '');
      return `<tr>
        <td style="padding:8px 12px;border-bottom:0.5px solid #f0f0ec;font-weight:600;font-size:11px;background:${rowBg};">
          ${r.trade}${r.manual ? ' <span style="font-size:8px;background:#FEF3C7;color:#854F0B;border:1px solid rgba(186,117,23,.35);border-radius:3px;padding:1px 4px;font-weight:700;letter-spacing:.05em;">MANUAL</span>' : ''}
        </td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #f0f0ec;text-align:right;font-size:11px;background:${rowBg};color:${r.est === null ? '#aaa' : '#1a1a1a'};">${fmtNum(r.est)}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #f0f0ec;text-align:right;font-size:11px;background:${rowBg};color:${r.fin === null ? '#aaa' : '#1B7CB0'};">${fmtNum(r.fin)}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #f0f0ec;text-align:right;font-size:11px;font-weight:700;background:${rowBg};color:#1F7A38;">${fmtNum(r.newv)}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #f0f0ec;text-align:right;font-size:11px;font-weight:600;background:${rowBg};color:${varColor};">${varText}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Budget Outlook · ${project.name}</title>
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
    .kpi-val { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi-label { font-size: 9px; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px 12px; font-size: 9px; letter-spacing: 0.07em; text-transform: uppercase; color: #888; background: #f5f5f2; border-bottom: 1px solid #e8e8e4; font-weight: 600; }
    th:first-child { text-align: left; }
    th:not(:first-child) { text-align: right; }
    .total-row td { background: #f5fdf7 !important; font-weight: 700; font-size: 11px; border-top: 2px solid #b2dfdb; padding: 9px 12px; text-align: right; }
    .total-row td:first-child { text-align: left; }
    .footer { margin-top: 14px; font-size: 9.5px; color: #bbb; display: flex; justify-content: space-between; }
    .legend { display: flex; gap: 14px; margin-bottom: 12px; font-size: 9.5px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-crop">
      <img class="logo-img" src="/lib_brand/lead_it_builders_logo.png" alt="Lead It Builders" />
    </div>
    <div class="header-text">
      <h1>Budget Outlook Report · ${project.name}</h1>
      <p>${project.location || project.id} · Generated ${date}</p>
    </div>
  </div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${bs.count}</div><div class="kpi-label">Total trades</div></div>
    <div class="kpi"><div class="kpi-val">${fmtFull(bs.est)}</div><div class="kpi-label">Estimated total</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#1F7A38;">${fmtFull(bs.newv)}</div><div class="kpi-label">New Budget</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${delta < 0 ? '#1F7A38' : '#A82828'};">${(delta < 0 ? '−' : '+') + fmtFull(Math.abs(delta))}</div><div class="kpi-label">Δ vs Estimated (${deltaPct < 0 ? '−' : '+'}${Math.abs(deltaPct).toFixed(1)}%)</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#1B7CB0;">${bs.withBids}</div><div class="kpi-label">Bids in</div></div>
  </div>
  <div class="legend">
    <span><strong style="color:#1F7A38;">Green</strong> = under estimate</span>
    <span><strong style="color:#A82828;">Red</strong> = over estimate</span>
    <span><strong style="color:#1B7CB0;">Blue</strong> = bid/contract received</span>
    <span><strong style="color:#854F0B;">MANUAL</strong> = auto-rule bypassed</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Trade</th>
        <th>Estimated Budget</th>
        <th>Finalized / Lowest Bid</th>
        <th>New Budget</th>
        <th>Variance vs Estimated</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td>Total</td>
        <td>${fmtFull(bs.est)}</td>
        <td>${fmtFull(bs.fin)}</td>
        <td style="color:#1F7A38;">${fmtFull(bs.newv)}</td>
        <td style="color:${delta < 0 ? '#1F7A38' : '#A82828'};">${(delta < 0 ? '−' : '+') + fmtFull(Math.abs(delta))} (${deltaPct < 0 ? '−' : '+'}${Math.abs(deltaPct).toFixed(1)}%)</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <span>Lead It Builders · Budget Outlook · ${date}</span>
    <span>New Budget = Finalized if available, otherwise Estimated carry-forward</span>
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function handleShareLink() {
    const url = `${window.location.origin}/budget/${encodeURIComponent(project.name)}/report`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onGoOverview} style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'inherit' }}>Portfolio</button>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, opacity: 0.6 }} />
        <span>{project.name} · Budget</span>
        <span style={{ flex: 1 }} />
        {/* Print / Share button group */}
        <div style={{ display: 'inline-flex', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', border: '0.5px solid var(--color-border-secondary)' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRight: '0.5px solid var(--color-border-secondary)' }}
          >
            <i className="ti ti-printer" style={{ fontSize: 13 }} />
            Print
          </button>
          <button
            type="button"
            onClick={handleShareLink}
            title="Copy live report link to clipboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: shareCopied ? 'var(--bid-fnl-bg)' : 'var(--color-background-secondary)', color: shareCopied ? 'var(--bid-fnl-fg)' : 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'background 0.2s, color 0.2s' }}
          >
            <i className={`ti ${shareCopied ? 'ti-check' : 'ti-link'}`} style={{ fontSize: 13 }} />
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      {/* Project header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start',
        paddingBottom: 14, borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 14,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em', margin: '0 0 6px' }}>{project.name}</h1>
          {project.location && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              <span><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: '-2px' }} /> {project.location}</span>
            </div>
          )}
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

// ──────────────────────────────────────────────────────────────
// VarianceView
// ──────────────────────────────────────────────────────────────
function VarianceView({ onBack }: { onBack: () => void }) {
  const { project } = useBudget();
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
        <span>{project.name} · Variance</span>
      </div>

      {/* 4-KPI strip */}
      {(() => {
        const netPct = bs.est > 0 ? (netDelta / bs.est * 100) : 0;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.25rem' }}>
            <KpiCard label="Total saved (vs est)" value={(totalSaved > 0 ? '−' : '') + fmt$(totalSaved)} sub={`${underTrades.length} trades under`} icon="ti-trending-down" tone="good" />
            <KpiCard label="Total over (vs est)" value={'+' + fmt$(totalOver)} sub={`${overTrades.length} trades over`} icon="ti-trending-up" tone="danger" />
            <KpiCard label="Net Δ vs estimated" value={(netDelta < 0 ? '−' : netDelta > 0 ? '+' : '') + fmt$(Math.abs(netDelta))} sub={netPct.toFixed(1) + '% vs estimate'} icon="ti-arrow-bounce" tone="amber" />
            <KpiCard label="Still estimate-only" value={String(eoCount)} sub="no bid yet · carry-forward" icon="ti-hourglass" tone="info" />
          </div>
        );
      })()}

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
  const { project } = useBudget();
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
        <span>{project.name} · Treemap</span>
      </div>

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
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Spend treemap · {project.name}</h2>
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
  const { project } = useBudget();
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
        <span>{project.name} · Categories</span>
      </div>

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
type ProjectTab = 'table' | 'variance' | 'treemap' | 'categories';

const PROJECT_TABS: { id: ProjectTab; label: string; icon: string }[] = [
  { id: 'table',      label: 'Table',      icon: 'ti-list-details' },
  { id: 'variance',   label: 'Variance',   icon: 'ti-chart-bar' },
  { id: 'treemap',    label: 'Treemap',    icon: 'ti-layout-grid' },
  { id: 'categories', label: 'Categories', icon: 'ti-list-tree' },
];

export function BudgetDashboard({ projectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams?.get('tab') ?? 'table') as ProjectTab;
  const [search, setSearch] = useState('');
  const [drawerTrade, setDrawerTrade] = useState<BudgetTrade | null>(null);
  const closeDrawer = useCallback(() => setDrawerTrade(null), []);

  const navigateToProject = useCallback(
    (id: string) => router.push(`/budget/${encodeURIComponent(id)}`),
    [router],
  );
  const navigateToPortfolio = useCallback(() => router.push('/budget'), [router]);
  const setTab = useCallback(
    (newTab: ProjectTab) => {
      if (!projectId) return;
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', newTab);
      router.push(`/budget/${encodeURIComponent(projectId)}?${params.toString()}`);
    },
    [router, projectId, searchParams],
  );

  // Portfolio data — only fetched in portfolio mode
  const { data: portfolioData, isLoading: portfolioLoading } = useSWR<BudgetPortfolioPayload>(
    projectId ? null : '/api/budget/portfolio',
    portfolioFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  // Per-project data — only fetched in project mode
  const { data: projectData, isLoading: projectLoading } = useSWR<BudgetPayload>(
    projectId ? `/api/budget/project/${encodeURIComponent(projectId)}` : null,
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
      const bs = computeStats(projectData.project.trades);
      return `${projectData.project.name} · ${projectData.project.trades.length} trades · ${fmt$(bs.newv)} new budget`;
    }
    if (!portfolioData) return 'Loading…';
    return `${portfolioData.projects.length} projects · live from ClickUp`;
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
      <div className="dashboard-shell">
        <LogoHeader title="Budget Dashboard" subtitleOverride="Loading from ClickUp…" syncedAt={null} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          <i className="ti ti-loader" style={{ fontSize: 20, marginRight: 8, animation: 'lib-spin 1s linear infinite' }} />
          Loading budget data…
        </div>
      </div>
    );
  }

  // No-token warning (portfolio mode)
  if (!projectId && portfolioData!.source === 'empty') {
    return (
      <div className="dashboard-shell">
        <LogoHeader title="Budget Dashboard" subtitleOverride="No ClickUp token" syncedAt={null} />
        <div style={{ padding: '32px 24px', color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          <strong>No data available.</strong> Add <code>CLICKUP_API_TOKEN</code> to{' '}
          <code>.env.local</code> to load live data.
        </div>
      </div>
    );
  }

  // No-token warning (project mode)
  if (projectId && projectData!.warning) {
    return (
      <div className="dashboard-shell">
        <LogoHeader title="Budget Dashboard" subtitleOverride={projectData!.warning} syncedAt={null} />
        <div style={{ padding: '32px 24px', color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          <strong>No data available.</strong> {projectData!.warning}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <LogoHeader
        title="Budget Dashboard"
        subtitleOverride={subtitle}
        syncedAt={syncedAt}
      />

      {/* Filter / navigation bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 8, fontSize: 13, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder={projectId ? 'Search trades…' : 'Search trades, projects…'}
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

        {/* Project picker */}
        <select
          value={projectId ?? ''}
          onChange={(e) => {
            if (!e.target.value) navigateToPortfolio();
            else navigateToProject(e.target.value);
          }}
          style={{
            height: 32, padding: '0 10px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            fontFamily: 'inherit', fontSize: 13, minWidth: 200, fontWeight: 500,
          }}
        >
          <option value="">★ All projects</option>
          {allProjectNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Tab strip — per-project mode only */}
        {projectId && (
          <div style={{
            display: 'flex', gap: 4, padding: 4,
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            marginLeft: 'auto',
          }}>
            {PROJECT_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '6px 14px', fontSize: 13, borderRadius: 'var(--border-radius-md)',
                  cursor: 'pointer',
                  border: tab === t.id ? '0.5px solid var(--color-border-secondary)' : '0.5px solid transparent',
                  background: tab === t.id ? 'var(--color-background-primary)' : 'transparent',
                  color: tab === t.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontWeight: tab === t.id ? 500 : 400,
                }}
              >
                <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content — portfolio mode */}
      {!projectId && (
        <PortfolioBudgetView
          portfolioData={portfolioData!}
          onNavigateToProject={navigateToProject}
          search={search}
        />
      )}

      {/* Content — per-project mode */}
      {projectId && projectData && (
        <BudgetCtx.Provider value={projectData}>
          {tab === 'table' && (
            <DetailedView
              onGoOverview={navigateToPortfolio}
              onTradeClick={setDrawerTrade}
            />
          )}
          {tab === 'variance' && <VarianceView onBack={navigateToPortfolio} />}
          {tab === 'treemap' && <TreemapView onBack={navigateToPortfolio} />}
          {tab === 'categories' && <CategoriesView onBack={navigateToPortfolio} />}
        </BudgetCtx.Provider>
      )}

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

