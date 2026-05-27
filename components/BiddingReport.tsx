'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import type { BiddingPayload, BidStatus, BidTrade } from '@/lib/bidding-types';

// ─── Hardcoded status palette (safe for print / no CSS vars) ──────────────────

const STATUS: Record<BidStatus, { bg: string; fg: string; ring: string; label: string }> = {
  ntb: { bg: '#E8E6E1', fg: '#3F3D38', ring: '#9C9A92', label: 'Not bidding' },
  snt: { bg: '#7DD3F2', fg: '#053A5F', ring: '#1B7CB0', label: 'Sent' },
  rec: { bg: '#FFE74A', fg: '#3D2D00', ring: '#9C7A00', label: 'Received' },
  hld: { bg: '#F47B7B', fg: '#3E0707', ring: '#A82828', label: 'Hold' },
  fnl: { bg: '#7DD68F', fg: '#0D3E18', ring: '#1F7A38', label: 'Finalized' },
  fu1: { bg: '#C8A7E6', fg: '#33124F', ring: '#6B3A95', label: 'FU · W1' },
  fu2: { bg: '#F8CEAC', fg: '#4A2308', ring: '#A85F18', label: 'FU · W2' },
  fu3: { bg: '#F5C8DD', fg: '#5A1338', ring: '#A8336E', label: 'FU · W3' },
};

function fmt$(n: number | null): string {
  if (n === null) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BiddingReport({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, mutate } = useSWR<BiddingPayload>(
    `/api/bidding/project/${encodeURIComponent(projectId)}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: true },
  );

  const project = data?.project;
  const trades = project?.trades ?? [];

  const kpis = useMemo(() => {
    const fnlCount = trades.filter((t: BidTrade) => t.subs.some((s) => s.status === 'fnl')).length;
    const outCount = trades.filter(
      (t: BidTrade) =>
        t.subs.some((s) => s.status === 'snt' || s.status === 'rec') &&
        !t.subs.some((s) => s.status === 'fnl'),
    ).length;
    const hldCount = trades.filter((t: BidTrade) => t.subs.some((s) => s.status === 'hld')).length;
    const total = trades.reduce((a: number, t: BidTrade) => a + (t.low ?? 0), 0);
    const fuCount = trades.filter((t: BidTrade) =>
      t.subs.some((s) => s.status === 'fu1' || s.status === 'fu2' || s.status === 'fu3'),
    ).length;
    return { total: trades.length, fnlCount, outCount, hldCount, fuCount, runningTotal: total };
  }, [trades]);

  const syncedAt = data?.syncedAt ? new Date(data.syncedAt) : null;
  const minsAgo = syncedAt ? Math.round((Date.now() - syncedAt.getTime()) / 60_000) : null;
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  function handleCopyLink() {
    const url = window.location.href;
    const onSuccess = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
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
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-only { display: flex !important; }
          .report-wrap { padding: 0 !important; background: #fff !important; }
          .report-card { box-shadow: none !important; }
        }
        .print-only { display: none; }
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
        {/* ── Header ─────────────────────────────────────────────────── */}
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
          {/* Logo */}
          <div style={{ width: 64, height: 64, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
            <img
              src="/lib_brand/lead_it_builders_logo.png"
              alt="Lead It Builders"
              style={{ position: 'absolute', width: 240, left: -19, top: -1 }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Bidding Report
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
              onClick={() => mutate()}
              title="Refresh"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                border: '0.5px solid #d4d4d0',
                borderRadius: 6,
                background: '#fff',
                color: '#555',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                border: '0.5px solid #d4d4d0',
                borderRadius: 6,
                background: copied ? '#f0fdf4' : '#fff',
                color: copied ? '#166534' : '#555',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                border: '0.5px solid #F47832',
                borderRadius: 6,
                background: '#F47832',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
              Print
            </button>
          </div>
        </div>

        {/* ── KPI strip ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
            marginBottom: 20,
          }}
        >
          {[
            { label: 'Total trades',   value: kpis.total,                             color: '#1a1a1a' },
            { label: 'Finalized',      value: kpis.fnlCount,                          color: '#1F7A38' },
            { label: 'Out for bid',    value: kpis.outCount,                          color: '#9C7A00' },
            { label: 'Follow-ups',     value: kpis.fuCount,                           color: '#6B3A95' },
            { label: 'Lowest running', value: fmt$(kpis.runningTotal),               color: '#1F7A38' },
          ].map((kpi, i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                border: '0.5px solid #e8e8e4',
                borderRadius: 10,
                padding: '12px 16px',
              }}
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

        {/* ── Status legend ──────────────────────────────────────────── */}
        <div
          className="no-print"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
        >
          {(Object.entries(STATUS) as [BidStatus, typeof STATUS[BidStatus]][]).map(([key, s]) => (
            <span
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 4,
                background: s.bg,
                color: s.fg,
                border: `1px solid ${s.ring}`,
                fontSize: 10.5,
                fontWeight: 500,
              }}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* ── Trade matrix ───────────────────────────────────────────── */}
        <div
          className="report-card"
          style={{
            background: '#fff',
            border: '0.5px solid #e8e8e4',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <colgroup>
                <col style={{ minWidth: 180 }} />
                {Array.from({ length: 5 }, (_, i) => <col key={i} style={{ minWidth: 140 }} />)}
                <col style={{ minWidth: 90 }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#f5f5f2' }}>
                  {['Trade', 'Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Sub 5', 'Lowest'].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '9px 10px',
                        fontSize: 9,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: '#888',
                        fontWeight: 600,
                        borderBottom: '1px solid #e8e8e4',
                        textAlign: i === 0 ? 'left' : i === 6 ? 'right' : 'center',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade: BidTrade, ti: number) => {
                  const subs5 = Array.from({ length: 5 }, (_, i) => trade.subs[i] ?? null);
                  const isEven = ti % 2 === 0;
                  return (
                    <tr
                      key={ti}
                      style={{ background: isEven ? '#fff' : '#fafaf8' }}
                    >
                      {/* Trade name */}
                      <td
                        style={{
                          padding: '9px 12px',
                          borderBottom: '0.5px solid #f0f0ec',
                          fontWeight: 600,
                          fontSize: 11.5,
                        }}
                      >
                        {trade.trade}
                        <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>
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
                                padding: '8px 8px',
                                borderBottom: '0.5px solid #f0f0ec',
                                textAlign: 'center',
                                color: '#ccc',
                                fontSize: 11,
                              }}
                            >
                              —
                            </td>
                          );
                        }
                        const st = STATUS[sub.status as BidStatus];
                        const isLow = sub.amount !== null && sub.amount === trade.low;
                        return (
                          <td
                            key={si}
                            style={{
                              padding: '6px 8px',
                              borderBottom: '0.5px solid #f0f0ec',
                              verticalAlign: 'top',
                            }}
                          >
                            {/* Name badge */}
                            <div
                              style={{
                                background: st.bg,
                                color: st.fg,
                                border: `1px solid ${st.ring}`,
                                borderRadius: '4px 4px 0 0',
                                borderBottom: 'none',
                                padding: '4px 7px',
                                fontSize: 10,
                                fontWeight: isLow ? 700 : 500,
                                textAlign: 'center',
                                lineHeight: 1.3,
                              }}
                            >
                              {sub.name}
                            </div>
                            {/* Amount badge */}
                            <div
                              style={{
                                background: isLow ? '#e8f5e9' : '#f8f8f6',
                                color: isLow ? '#1F7A38' : '#555',
                                border: `1px solid ${isLow ? '#81c784' : '#e0e0dc'}`,
                                borderTop: 'none',
                                borderRadius: '0 0 4px 4px',
                                padding: '3px 7px',
                                fontSize: 10,
                                fontWeight: isLow ? 700 : 400,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {sub.amount !== null ? fmt$(sub.amount) : '—'}
                            </div>
                          </td>
                        );
                      })}

                      {/* Lowest bid */}
                      <td
                        style={{
                          padding: '9px 12px',
                          borderBottom: '0.5px solid #f0f0ec',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: trade.low !== null ? '#1F7A38' : '#aaa',
                          fontSize: 12,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmt$(trade.low)}
                      </td>
                    </tr>
                  );
                })}

                {/* Running total row */}
                <tr style={{ background: '#f5fdf7' }}>
                  <td
                    style={{
                      padding: '10px 12px',
                      fontWeight: 700,
                      fontSize: 11.5,
                      borderTop: '2px solid #b2dfdb',
                      color: '#1a1a1a',
                    }}
                  >
                    Total — lowest column — running
                  </td>
                  {Array.from({ length: 5 }, (_, i) => (
                    <td
                      key={i}
                      style={{
                        borderTop: '2px solid #b2dfdb',
                        background: '#f5fdf7',
                      }}
                    />
                  ))}
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#1F7A38',
                      borderTop: '2px solid #b2dfdb',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt$(kpis.runningTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Status legend for print ───────────────────────────────── */}
        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}
        >
          {(Object.entries(STATUS) as [BidStatus, typeof STATUS[BidStatus]][]).map(([key, s]) => (
            <span
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 4,
                background: s.bg,
                color: s.fg,
                border: `1px solid ${s.ring}`,
                fontSize: 9.5,
                fontWeight: 500,
              }}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 20,
            fontSize: 10,
            color: '#bbb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Lead It Builders · Bidding Report · {dateStr}</span>
          <span>
            Live from ClickUp · auto-refreshes every 5 min
            {minsAgo !== null && ` · synced ${minsAgo < 1 ? 'just now' : `${minsAgo}m ago`}`}
          </span>
        </div>

        {/* ── Print-only live link ───────────────────────────────────── */}
        <div
          className="print-only"
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '0.5px solid #e8e8e4',
            fontSize: 9.5,
            color: '#888',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F47832" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
          </svg>
          <span style={{ color: '#555' }}>Live report:</span>
          <a
            href={typeof window !== 'undefined' ? window.location.href : ''}
            style={{ color: '#F47832', fontWeight: 600, wordBreak: 'break-all' }}
          >
            {typeof window !== 'undefined' ? window.location.href : ''}
          </a>
          <span style={{ marginLeft: 'auto', color: '#bbb' }}>Open this URL to refresh · data updates every 5 min</span>
        </div>
      </div>
    </>
  );
}
