'use client';

import { useMemo } from 'react';

import { buildPermitsCalendar } from '@/lib/permits-calendar';
import type { DashboardPayload } from '@/lib/types';
import { permitsSearchUrl, taskUrl } from '@/lib/urls';

import { LogoHeader } from './LogoHeader';

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

export function PermitsDashboard({ initial, initialError }: Props) {
  const payload = initial;

  const calendar = useMemo(
    () => buildPermitsCalendar(payload?.projects ?? []),
    [payload?.projects],
  );

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
          <a
            href={allPermitsHref}
            target="_blank"
            rel="noopener"
            style={{
              fontSize: 12,
              color: 'var(--color-text-info)',
              fontWeight: 500,
            }}
          >
            View all permits in ClickUp →
          </a>
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
