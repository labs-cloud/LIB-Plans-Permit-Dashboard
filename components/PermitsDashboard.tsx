'use client';

import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { buildPermitsCalendar } from '@/lib/permits-calendar';
import { buildDetailedGroups, type DetailedProjectGroup, type DetailedPermitRow } from '@/lib/permits-detailed';
import type { DashboardPayload } from '@/lib/types';
import { folderUrl, listUrl, permitsSearchUrl, taskUrl } from '@/lib/urls';

import { LogoHeader } from './LogoHeader';
import { PermitsDetailedView } from './PermitsDetailedView';

interface Props {
  initial: DashboardPayload | null;
  initialError?: string | null;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function dayClass(worst: 'active' | 'expiring' | 'expired' | null, isToday: boolean): string {
  const parts = ['permits-cal-day'];
  if (isToday) parts.push('is-today');
  if (worst === 'active') parts.push('has-active');
  else if (worst === 'expiring') parts.push('has-expiring');
  else if (worst === 'expired') parts.push('has-expired');
  return parts.join(' ');
}

function rowClass(status: 'active' | 'expiring' | 'expired'): string {
  return `permits-list-row is-${status}`;
}

type PermitsView = 'overview' | 'detailed';

export function PermitsDashboard({ initial, initialError }: Props) {
  const payload = initial;
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const view: PermitsView =
    searchParams.get('view') === 'detailed' ? 'detailed' : 'overview';

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const setView = useCallback(
    (v: PermitsView) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (v === 'overview') params.delete('view');
      else params.set('view', v);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router],
  );

  const calendar = useMemo(
    () => buildPermitsCalendar(payload?.projects ?? []),
    [payload?.projects],
  );

  // All projects for the picker — uses permitsSummary so it's always populated
  // even when no "04. Permits" list exists for a project.
  const pickerProjects = useMemo<PickerProject[]>(() => {
    return (payload?.projects ?? [])
      .map((p) => ({
        folderId: p.folderId,
        name: p.name,
        totals: {
          total: p.permitsSummary.total,
          active: p.permitsSummary.active,
          expiring: p.permitsSummary.expiring,
          expired: p.permitsSummary.expired,
        },
      }))
      .sort((a, b) => {
        const score = (t: PickerProject['totals']) =>
          t.expired * 1000 + t.expiring * 10 + t.active;
        return score(b.totals) - score(a.totals);
      });
  }, [payload?.projects]);

  const filteredPickerProjects = useMemo(() => {
    if (!projectSearch.trim()) return pickerProjects;
    const q = projectSearch.toLowerCase();
    return pickerProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [pickerProjects, projectSearch]);

  // Detailed permit data (only projects that have actual permit rows in ClickUp)
  const projectGroups = useMemo(
    () => buildDetailedGroups(payload?.projects ?? []),
    [payload?.projects],
  );

  // Selected project detail — falls back to a minimal group if no permit rows exist
  const selectedProject = useMemo<DetailedProjectGroup | null>(() => {
    if (!selectedFolderId) return null;
    const fromGroups = projectGroups.find((g) => g.folderId === selectedFolderId);
    if (fromGroups) return fromGroups;
    const proj = payload?.projects?.find((p) => p.folderId === selectedFolderId);
    if (!proj) return null;
    return {
      folderId: proj.folderId,
      name: proj.name,
      phaseLabel: proj.phaseLabel,
      coord: proj.coord,
      permitsListId: proj.permitsListId,
      permits: [],
      totals: { total: 0, active: 0, expiring: 0, expired: 0 },
      earliestExpiration: null,
    };
  }, [selectedFolderId, projectGroups, payload?.projects]);

  const permits = payload?.permits;

  const allPermitsHref = permitsSearchUrl(permits?.allPermitsListIds ?? []);

  const warning = initialError ?? payload?.warning ?? null;

  return (
    <div
      className="dashboard-shell"
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
      }}
    >
      <LogoHeader
        title="Permits Dashboard"
        subtitleOverride={(() => {
          const active = permits?.active ?? 0;
          const projects = permits?.activeProjects ?? 0;
          const expiring = permits?.expiring30d ?? 0;
          const expired = permits?.expired ?? 0;
          const tail =
            expired > 0
              ? `${expired} expired · ${expiring} expiring 30d`
              : `${expiring} expiring in 30d`;
          return `${active} active permits across ${projects} project${
            projects === 1 ? '' : 's'
          } · ${tail}`;
        })()}
        syncedAt={payload?.syncedAt ?? null}
        warning={warning}
      />

      <div className="permits-panel">
        <div className="permits-panel-h">
          <div>
            <h2>
              <i className="ti ti-license" /> Permits dashboard
            </h2>
            <div className="permits-sub">
              Active permits · expiration tracking · agency breakdown
            </div>
          </div>
          <div
            className="permits-view-toggle"
            role="tablist"
            aria-label="Permits view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'overview'}
              className={view === 'overview' ? 'active' : ''}
              onClick={() => setView('overview')}
            >
              <i className="ti ti-layout-dashboard" /> Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'detailed'}
              className={view === 'detailed' ? 'active' : ''}
              onClick={() => setView('detailed')}
            >
              <i className="ti ti-list-details" /> Detailed
            </button>
          </div>
        </div>

        <div className="permits-kpis">
          <div className="permits-kpi good">
            <div className="l">Active permits</div>
            <div className="v">{permits?.active ?? 0}</div>
            <div className="s">
              across {permits?.activeProjects ?? 0} project
              {(permits?.activeProjects ?? 0) === 1 ? '' : 's'}
            </div>
          </div>
          <div className="permits-kpi warn">
            <div className="l">Expiring · 30d</div>
            <div className="v">{permits?.expiring30d ?? 0}</div>
            <div className="s">
              on {permits?.expiring30dProjects ?? 0} project
              {(permits?.expiring30dProjects ?? 0) === 1 ? '' : 's'}
            </div>
          </div>
          <div className="permits-kpi danger">
            <div className="l">Expired</div>
            <div className="v">{permits?.expired ?? 0}</div>
            <div className="s">stop-work risk</div>
          </div>
        </div>

        {/* ── Project picker (overview) ───────────────── */}
        {view === 'overview' && (
          <ProjectPicker
            projects={filteredPickerProjects}
            allProjects={pickerProjects}
            search={projectSearch}
            onSearch={setProjectSearch}
            selectedFolderId={selectedFolderId}
            onSelect={(id) => setSelectedFolderId(id === selectedFolderId ? null : id)}
          />
        )}

        {view === 'overview' && selectedFolderId && selectedProject && (
          <ProjectPermitsDetail
            group={selectedProject}
            onClose={() => setSelectedFolderId(null)}
          />
        )}

        {view === 'overview' && (
        <div className="permits-view-subhead">
          <span className="crumb">
            <i className="ti ti-calendar-month" />
            <b>Overview</b> · forward-looking 90-day read
          </span>
          <a
            href={allPermitsHref}
            target="_blank"
            rel="noopener"
            style={{ fontSize: 12, color: 'var(--color-text-info)', fontWeight: 500 }}
          >
            View all permits in ClickUp →
          </a>
        </div>
        )}

        {view === 'overview' && (
        <div className="permits-cal-wrap">
          <div className="permits-cal-card">
            <div className="permits-card-h">
              <i className="ti ti-calendar" /> Expiration calendar
              <span className="permits-meta">
                next 90 days · {calendar.totalIn90} permit
                {calendar.totalIn90 === 1 ? '' : 's'}
              </span>
            </div>

            <div className="permits-cal-months">
              {calendar.months.map((m) => (
                <div className="permits-cal-month" key={`${m.year}-${m.month}`}>
                  <div className="name">
                    <span>{m.label}</span>
                    <span className="count">
                      {m.expiringCount > 0
                        ? `${m.expiringCount} expiring`
                        : 'no expirations'}
                    </span>
                  </div>
                  <div className="permits-cal-grid">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <span className="permits-cal-dow" key={`dow-${m.month}-${i}`}>
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: m.leadingBlanks }).map((_, i) => (
                      <span
                        key={`blank-${m.month}-${i}`}
                        className="permits-cal-day is-blank"
                      />
                    ))}
                    {m.days.map((day) => {
                      const cls = dayClass(day.worstStatus, day.isToday);
                      return (
                        <span
                          key={day.iso}
                          className={cls}
                          title={
                            day.permits.length > 0
                              ? day.permits
                                  .map((p) => `${p.name} · ${p.projectName}`)
                                  .join('\n')
                              : ''
                          }
                        >
                          <span className="n">{day.date}</span>
                          {day.permits.length > 0 && (
                            <span className="pip">
                              {day.permits.slice(0, 4).map((p) => (
                                <span key={p.id} className="dot-mini" />
                              ))}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="permits-legend">
              <span className="sw">
                <i style={{ background: 'var(--danger-strong)' }} />
                Expired
              </span>
              <span className="sw">
                <i style={{ background: 'var(--warn-strong)' }} />
                Expiring ≤30d
              </span>
              <span className="sw">
                <i style={{ background: 'var(--good-strong)' }} />
                Expires 31–90d
              </span>
              <span className="sw">
                <i style={{ background: 'var(--lib-black)' }} />
                Today
              </span>
            </div>
          </div>

          <div className="permits-cal-card">
            <div className="permits-card-h">
              <i className="ti ti-clock-hour-4" /> Upcoming expirations
              <span className="permits-meta">chronological</span>
            </div>
            <div className="permits-list">
              {calendar.upcoming.length === 0 ? (
                <div
                  style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 12,
                  }}
                >
                  No upcoming expirations
                </div>
              ) : (
                calendar.upcoming.map((p) => {
                  const exp = new Date(p.expirationDate);
                  const countdown =
                    p.status === 'expired'
                      ? `${Math.abs(p.daysToExpiration)}d ago`
                      : `${p.daysToExpiration}d`;
                  return (
                    <a
                      key={`${p.id}-${p.expirationDate}`}
                      href={taskUrl(p.id)}
                      target="_blank"
                      rel="noopener"
                      className={rowClass(p.status)}
                    >
                      <div className="when">
                        <div className="d">{exp.getDate()}</div>
                        <div className="mo">{MONTH_SHORT[exp.getMonth()]}</div>
                      </div>
                      <div className="info">
                        <div className="agency">{p.agency}</div>
                        <div className="name">{p.name}</div>
                        <div className="proj">{p.projectName}</div>
                      </div>
                      <span className="countdown">{countdown}</span>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>
        )}

        {view === 'detailed' && (
          <PermitsDetailedView projects={payload?.projects ?? []} />
        )}
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
        }}
      >
        Live from ClickUp · 60-second cache · click any permit to open in ClickUp
      </div>
    </div>
  );
}

// ─── ProjectPicker ─────────────────────────────────────────────────────────

interface PickerProject {
  folderId: string;
  name: string;
  totals: { total: number; active: number; expiring: number; expired: number };
}

function ProjectPicker({
  projects,
  allProjects,
  search,
  onSearch,
  selectedFolderId,
  onSelect,
}: {
  projects: PickerProject[];
  allProjects: PickerProject[];
  search: string;
  onSearch: (v: string) => void;
  selectedFolderId: string | null;
  onSelect: (id: string) => void;
}) {
  const urgentCount = allProjects.filter(
    (p) => p.totals.expired > 0 || p.totals.expiring > 0,
  ).length;

  return (
    <div style={{
      margin: '0 0 16px',
      border: '0.5px solid var(--color-border-secondary)',
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Picker header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'var(--color-background-secondary)',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
      }}>
        <i className="ti ti-building-skyscraper" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
          Select a project
          <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
            · {allProjects.length} project{allProjects.length === 1 ? '' : 's'}
          </span>
          {urgentCount > 0 && (
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--danger-strong)', fontWeight: 700 }}>
              · {urgentCount} need attention
            </span>
          )}
        </span>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search address…"
            style={{
              paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
              fontSize: 12, border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)', background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)', fontFamily: 'inherit', width: 180,
            }}
          />
        </div>
      </div>

      {/* Project rows */}
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {projects.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            No projects match "{search}".
          </div>
        ) : (
          projects.map((p) => {
            const isSelected = p.folderId === selectedFolderId;
            const isHot = p.totals.expired > 0 || p.totals.expiring > 0;
            const hasPermits = p.totals.total > 0;
            return (
              <button
                key={p.folderId}
                type="button"
                onClick={() => onSelect(p.folderId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 14px',
                  border: 'none', borderBottom: '0.5px solid var(--color-border-tertiary)',
                  background: isSelected ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  borderLeft: isSelected ? '3px solid var(--lib-black)' : '3px solid transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-background-secondary)'; }}
                onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-background-primary)'; }}
              >
                <i className="ti ti-map-pin" style={{ fontSize: 12, color: isHot ? 'var(--danger-strong)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: isHot ? 600 : 400, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <span style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {p.totals.expired > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'var(--danger-bg)', color: 'var(--danger-strong)' }}>
                      {p.totals.expired} expired
                    </span>
                  )}
                  {p.totals.expiring > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'var(--warn-bg)', color: 'var(--warn-strong)' }}>
                      {p.totals.expiring} expiring
                    </span>
                  )}
                  {hasPermits && p.totals.expired === 0 && p.totals.expiring === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good-strong)' }}>
                      {p.totals.active} active
                    </span>
                  )}
                  {!hasPermits && (
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                      no permits
                    </span>
                  )}
                </span>
                <i className="ti ti-chevron-right" style={{ fontSize: 12, color: 'var(--color-text-tertiary)', opacity: isSelected ? 0 : 0.5 }} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── ProjectPermitsDetail ───────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function shortDate(ts: number | null): string {
  if (ts == null) return '—';
  const d = new Date(ts);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function statusLabel(p: DetailedPermitRow): string {
  if (p.status === 'expired') return p.daysLeft != null ? `Expired · ${Math.abs(p.daysLeft)}d ago` : 'Expired';
  if (p.status === 'expiring') return p.daysLeft != null ? `Expiring · ${p.daysLeft}d` : 'Expiring';
  return p.daysLeft != null ? `Active · ${p.daysLeft}d left` : 'Active';
}

type DetailTab = 'urgent' | 'all';

function ProjectPermitsDetail({ group, onClose }: { group: DetailedProjectGroup; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>('urgent');
  const openHref = group.permitsListId ? listUrl(group.permitsListId) : folderUrl(group.folderId);

  const urgentPermits = group.permits.filter((p) => p.status === 'expired' || p.status === 'expiring');
  const shownPermits = tab === 'urgent' ? urgentPermits : group.permits;
  const hasUrgent = urgentPermits.length > 0;

  const statusColors: Record<string, { bg: string; color: string }> = {
    expired:  { bg: 'var(--danger-bg)',  color: 'var(--danger-strong)' },
    expiring: { bg: 'var(--warn-bg)',    color: 'var(--warn-strong)' },
    active:   { bg: 'var(--good-bg)',    color: 'var(--good-strong)' },
  };

  const th: CSSProperties = {
    padding: '8px 12px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      margin: '0 0 16px',
      border: '0.5px solid var(--color-border-secondary)',
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Detail header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'var(--color-background-secondary)',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
      }}>
        <i className="ti ti-license" style={{ fontSize: 14 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{group.name}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {group.totals.total} permit{group.totals.total === 1 ? '' : 's'}
        </span>

        {/* Tab toggle */}
        <div style={{ display: 'inline-flex', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
          {hasUrgent && (
            <button
              type="button"
              onClick={() => setTab('urgent')}
              style={{
                padding: '3px 10px', fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: tab === 'urgent' ? 'var(--lib-black)' : 'transparent',
                color: tab === 'urgent' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              Expired / Expiring <span style={{ fontWeight: 700 }}>{urgentPermits.length}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('all')}
            style={{
              padding: '3px 10px', fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === 'all' ? 'var(--lib-black)' : 'transparent',
              color: tab === 'all' ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            All permits
          </button>
        </div>

        <a href={openHref} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-info)', textDecoration: 'none', fontWeight: 500 }}>
          Open in ClickUp <i className="ti ti-arrow-up-right" style={{ fontSize: 11 }} />
        </a>

        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}
          title="Close"
        >
          <i className="ti ti-x" style={{ fontSize: 14 }} />
        </button>
      </div>

      {/* Permits table */}
      {shownPermits.length === 0 ? (
        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
          No {tab === 'urgent' ? 'expired or expiring' : ''} permits.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <colgroup>
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Permit</th>
                <th style={{ ...th, textAlign: 'left' }}>Issued</th>
                <th style={{ ...th, textAlign: 'left' }}>Expires</th>
                <th style={{ ...th, textAlign: 'left' }}>Lifecycle</th>
                <th style={{ ...th, textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {shownPermits.map((p) => {
                const sc = statusColors[p.status] ?? statusColors.active;
                return (
                  <tr
                    key={p.id}
                    onClick={() => window.open(taskUrl(p.id), '_blank', 'noopener')}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', fontSize: 12 }}>{shortDate(p.filingDate)}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', fontSize: 12 }}>{shortDate(p.expirationDate)}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      {p.lifecyclePct == null ? (
                        <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      ) : (
                        <div>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--color-border-secondary)', overflow: 'hidden', marginBottom: 3 }}>
                            <div style={{ height: '100%', width: `${p.lifecyclePct}%`, background: p.status === 'expired' ? 'var(--danger-strong)' : p.status === 'expiring' ? 'var(--warn-strong)' : 'var(--good-strong)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10.5, color: 'var(--color-text-tertiary)' }}>
                            {p.lifecyclePct}% used{p.daysLeft != null ? (p.daysLeft < 0 ? ` · ${Math.abs(p.daysLeft)}d overdue` : ` · ${p.daysLeft}d left`) : ''}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                        {statusLabel(p)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
