'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import type { BudgetPayload, BudgetTrade, MoneyVal } from '@/lib/budget-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMoney(v: MoneyVal): v is number {
  return typeof v === 'number';
}

function fmt$(v: MoneyVal): string {
  if (v === null || v === undefined) return '–';
  if (v === 'INC') return 'Included';
  if (v === 'NA') return 'NA';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e4) return '$' + (v / 1e3).toFixed(0) + 'k';
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtFull$(v: MoneyVal): string {
  if (v === null || v === undefined) return '–';
  if (v === 'INC') return 'Included';
  if (v === 'NA') return 'NA';
  return '$' + (v as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeStats(trades: BudgetTrade[]) {
  let est = 0, fin = 0, newv = 0, withBids = 0, eo = 0;
  for (const r of trades) {
    if (isMoney(r.est)) est += r.est;
    if (isMoney(r.fin)) { fin += r.fin; withBids++; }
    if (isMoney(r.newv)) newv += r.newv;
    if (isMoney(r.est) && !isMoney(r.fin) && r.newv !== 'INC' && r.newv !== 'NA') eo++;
  }
  return { est, fin, newv, withBids, eo, count: trades.length };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BudgetReport({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, mutate } = useSWR<BudgetPayload>(
    `/api/budget/project/${encodeURIComponent(projectId)}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: true },
  );

  const project = data?.project;
  const trades = project?.trades ?? [];

  const kpis = useMemo(() => computeStats(trades), [trades]);

  const syncedAt = data?.syncedAt ? new Date(data.syncedAt) : null;
  const minsAgo = syncedAt ? Math.round((Date.now() - syncedAt.getTime()) / 60_000) : null;
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const delta = kpis.newv - kpis.est;
  const deltaPct = kpis.est > 0 ? (delta / kpis.est) * 100 : 0;

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  if (isLoading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#666', gap: 10 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #F47832', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        Loading live report…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (data.warning) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#666' }}>
        {data.warning}
      </div>
    );
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; }
        @page { size: landscape; margin: 10mm 12mm; }
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .report-wrap { padding: 0 !important; background: #fff !important; }
          .report-card { box-shadow: none !important; border: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        className="report-wrap"
        style={{
          minHeight: '100vh',
          background: '#f7f7f5',
          padding: '24px 32px 48px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: '#1a1a1a',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            borderBottom: '3px solid #F47832',
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ width: 60, height: 65, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
            <img
              src="/lib_brand/lead_it_builders_logo.png"
              alt="Lead It Builders"
              style={{ position: 'absolute', width: 225, height: 'auto', left: -19, top: -1, maxWidth: 'none' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Budget Outlook Report
            </h1>
            <p style={{ fontSize: 13, color: '#666', marginTop: 3 }}>
              {project?.name}
              {project?.location ? ` · ${project.location}` : ''}
              {' · '}
              {dateStr}
            </p>
          </div>

          {/* Live indicator + actions */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={async () => { await fetch('/api/refresh', { method: 'POST' }); mutate(); }}
              title="Refresh from ClickUp"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', border: '0.5px solid #d4d4d0', borderRadius: 6,
                background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
              </svg>
              {minsAgo !== null ? (minsAgo < 1 ? 'Live' : `${minsAgo}m ago`) : 'Live'}
            </button>
            <button
              onClick={handleCopyLink}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', border: '0.5px solid #d4d4d0', borderRadius: 6,
                background: copied ? '#f0fdf4' : '#fff',
                color: copied ? '#166534' : '#555',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              )}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={() => window.print()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', border: '0.5px solid #F47832', borderRadius: 6,
                background: '#F47832', color: '#fff',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
              Print
            </button>
          </div>
        </div>

        {/* ── KPI strip ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total trades',    value: String(kpis.count),    color: '#1a1a1a' },
            { label: 'Estimated total', value: fmt$(kpis.est),        color: '#1a1a1a' },
            { label: 'New Budget',      value: fmt$(kpis.newv),       color: '#1F7A38' },
            {
              label: 'Δ vs Estimated',
              value: (delta < 0 ? '−' : delta > 0 ? '+' : '') + fmt$(Math.abs(delta))
                + ' (' + (deltaPct < 0 ? '−' : '+') + Math.abs(deltaPct).toFixed(1) + '%)',
              color: delta < 0 ? '#1F7A38' : delta > 0 ? '#A82828' : '#666',
            },
            { label: 'Bids in',         value: String(kpis.withBids), color: '#1B7CB0' },
          ].map((kpi, i) => (
            <div
              key={i}
              style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 10, padding: '12px 16px' }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Trade table ──────────────────────────────────────────── */}
        <div
          className="report-card"
          style={{ background: '#fff', border: '0.5px solid #e8e8e4', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <colgroup>
                <col style={{ minWidth: 200 }} />
                <col style={{ minWidth: 130 }} />
                <col style={{ minWidth: 130 }} />
                <col style={{ minWidth: 130 }} />
                <col style={{ minWidth: 160 }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#f5f5f2' }}>
                  {[
                    { h: 'Trade',                  align: 'left'  as const },
                    { h: 'Estimated Budget',       align: 'right' as const },
                    { h: 'Finalized / Lowest Bid', align: 'right' as const },
                    { h: 'New Budget',             align: 'right' as const },
                    { h: 'Variance vs Estimated',  align: 'right' as const },
                  ].map(({ h, align }, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '9px 12px', fontSize: 9, letterSpacing: '0.07em',
                        textTransform: 'uppercase', color: '#888', fontWeight: 600,
                        borderBottom: '1px solid #e8e8e4', textAlign: align,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((r: BudgetTrade, ti: number) => {
                  const isEven = ti % 2 === 0;
                  const d = isMoney(r.newv) && isMoney(r.est) ? (r.newv - r.est) : null;
                  const dp = d !== null && isMoney(r.est) && r.est > 0 ? (d / r.est * 100) : null;
                  const varColor = d === null ? '#aaa' : d < 0 ? '#1F7A38' : d > 0 ? '#A82828' : '#555';
                  return (
                    <tr key={ti} style={{ background: isEven ? '#fff' : '#fafaf8' }}>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #f0f0ec', fontWeight: 600, fontSize: 11.5 }}>
                        {r.trade}
                        {r.manual && (
                          <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 600, color: '#854F0B', background: '#FEF3C7', border: '1px solid rgba(186,117,23,0.35)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em', textTransform: 'uppercase', verticalAlign: 'middle' }}>
                            Manual
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #f0f0ec', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: r.est === null ? '#aaa' : '#1a1a1a' }}>
                        {fmt$(r.est)}
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #f0f0ec', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: r.fin === null ? '#aaa' : '#1B7CB0' }}>
                        {fmt$(r.fin)}
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #f0f0ec', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, fontWeight: 700, color: '#1F7A38' }}>
                        {fmt$(r.newv)}
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid #f0f0ec', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, fontWeight: 600, color: varColor }}>
                        {d === null ? '–' : (
                          (d < 0 ? '−' : d > 0 ? '+' : '') + fmt$(Math.abs(d))
                          + (dp !== null ? ` (${dp < 0 ? '−' : '+'}${Math.abs(dp).toFixed(1)}%)` : '')
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr style={{ background: '#f5fdf7' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, borderTop: '2px solid #b2dfdb', color: '#1a1a1a' }}>
                    Total
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 12, borderTop: '2px solid #b2dfdb', fontVariantNumeric: 'tabular-nums', color: '#1a1a1a' }}>
                    {fmtFull$(kpis.est)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 12, borderTop: '2px solid #b2dfdb', fontVariantNumeric: 'tabular-nums', color: '#1B7CB0' }}>
                    {fmtFull$(kpis.fin)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, borderTop: '2px solid #b2dfdb', fontVariantNumeric: 'tabular-nums', color: '#1F7A38' }}>
                    {fmtFull$(kpis.newv)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 12, borderTop: '2px solid #b2dfdb', fontVariantNumeric: 'tabular-nums', color: delta < 0 ? '#1F7A38' : delta > 0 ? '#A82828' : '#555' }}>
                    {(delta < 0 ? '−' : delta > 0 ? '+' : '') + fmtFull$(Math.abs(delta))}
                    {' '}
                    <span style={{ fontSize: 11, opacity: 0.8 }}>
                      ({deltaPct < 0 ? '−' : '+'}{Math.abs(deltaPct).toFixed(1)}%)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Legend ───────────────────────────────────────────────── */}
        <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: '#888' }}>
          <span><span style={{ color: '#1F7A38', fontWeight: 700 }}>Green</span> = under estimate (savings)</span>
          <span><span style={{ color: '#A82828', fontWeight: 700 }}>Red</span> = over estimate (overrun)</span>
          <span><span style={{ color: '#1B7CB0', fontWeight: 700 }}>Blue</span> = bid/contract received</span>
          <span><span style={{ color: '#854F0B', fontWeight: 700 }}>Manual</span> = auto-rule bypassed</span>
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div style={{ marginTop: 20, fontSize: 10, color: '#bbb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Lead It Builders · Budget Outlook Report · {dateStr}</span>
          <span>
            Live from ClickUp · auto-refreshes every 5 min
            {minsAgo !== null && ` · synced ${minsAgo < 1 ? 'just now' : `${minsAgo}m ago`}`}
          </span>
        </div>
      </div>
    </>
  );
}
