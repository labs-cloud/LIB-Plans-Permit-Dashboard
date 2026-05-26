'use client';

import { useMemo, useState } from 'react';

import { COORD_BY_ID } from '@/lib/constants';
import {
  buildDetailedGroups,
  countGroups,
  filterGroups,
  type DetailedFilter,
  type DetailedProjectGroup,
  type DetailedPermitRow,
} from '@/lib/permits-detailed';
import type { Project } from '@/lib/types';
import { folderUrl, listUrl, taskUrl } from '@/lib/urls';

interface Props {
  projects: Project[];
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

function shortDate(ts: number | null): string {
  if (ts == null) return '—';
  const d = new Date(ts);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function statusLabel(row: DetailedPermitRow): string {
  if (row.status === 'expired') {
    const d = row.daysLeft;
    return d != null ? `Expired · ${Math.abs(d)}d ago` : 'Expired';
  }
  if (row.status === 'expiring') {
    return row.daysLeft != null ? `Expiring · ${row.daysLeft}d` : 'Expiring';
  }
  return row.daysLeft != null ? `Active · ${row.daysLeft}d` : 'Active';
}

export function PermitsDetailedView({ projects }: Props) {
  const [filter, setFilter] = useState<DetailedFilter>('all');
  const [search, setSearch] = useState('');

  const allGroups = useMemo(() => buildDetailedGroups(projects), [projects]);
  const counts = useMemo(() => countGroups(allGroups), [allGroups]);
  const visible = useMemo(
    () => filterGroups(allGroups, filter, search),
    [allGroups, filter, search],
  );

  const totalPermits = allGroups.reduce((sum, g) => sum + g.totals.total, 0);

  return (
    <div className="permits-detailed">
      <div className="view-subhead">
        <span className="crumb">
          <i className="ti ti-list-details" /> <b>Detailed</b>
          {` · ${totalPermits} permit${totalPermits === 1 ? '' : 's'} across ${
            allGroups.length
          } project${allGroups.length === 1 ? '' : 's'} · grouped by address`}
        </span>
      </div>

      <div className="det-toolbar">
        <div className="search">
          <i className="ti ti-search" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address, permit, agency…"
          />
        </div>
        <div className="filter-pills">
          {(
            [
              { id: 'all', label: 'All', count: counts.all },
              { id: 'expiring', label: 'Expiring ≤30d', count: counts.expiring },
              { id: 'active', label: 'Active', count: counts.active },
              { id: 'expired', label: 'Expired', count: counts.expired },
            ] as { id: DetailedFilter; label: string; count: number }[]
          ).map((p) => (
            <button
              type="button"
              key={p.id}
              className={`fp${filter === p.id ? ' active' : ''}`}
              onClick={() => setFilter(p.id)}
            >
              {p.label}
              <span className="count">{p.count}</span>
            </button>
          ))}
        </div>
        <div className="sort">
          <i className="ti ti-arrows-sort" /> Soonest expiration first
        </div>
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 13,
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-lg)',
          }}
        >
          No permits match these filters.
        </div>
      ) : (
        visible.map((g) => <ProjectGroup key={g.folderId} group={g} />)
      )}
    </div>
  );
}

function ProjectGroup({ group }: { group: DetailedProjectGroup }) {
  const coord = COORD_BY_ID[group.coord];
  const hotClass =
    group.totals.expired > 0
      ? ' has-expired'
      : group.totals.expiring > 0
        ? ' has-expiring'
        : '';

  const openHref = group.permitsListId
    ? listUrl(group.permitsListId)
    : folderUrl(group.folderId);

  return (
    <div className={`proj-group${hotClass}`}>
      <div className="ph">
        <div className="addr">
          <span className="name" title={group.name}>
            {group.name}
          </span>
        </div>
        <span className={`coord-chip ${group.coord}`}>
          <span className={`avatar avatar-${group.coord}`}>{coord.initials}</span>
          {coord.name.split(' ')[0]}
        </span>
        <span className="phase">
          <i className="ti ti-pencil-ruler" />
          {group.phaseLabel ?? 'Unphased'}
        </span>
        <span className="perm-tally">
          <span className="pill-mini total">
            {group.totals.total} permit{group.totals.total === 1 ? '' : 's'}
          </span>
          {group.totals.expired > 0 && (
            <span className="pill-mini expired">
              {group.totals.expired} expired
            </span>
          )}
          {group.totals.expiring > 0 && (
            <span className="pill-mini expiring">
              {group.totals.expiring} expiring
            </span>
          )}
          {group.totals.expired === 0 &&
            group.totals.expiring === 0 &&
            group.totals.active > 0 && (
              <span className="pill-mini active">
                {group.totals.active} active
              </span>
            )}
        </span>
        <a
          className="open-link"
          href={openHref}
          target="_blank"
          rel="noopener"
        >
          Project <i className="ti ti-arrow-up-right" />
        </a>
      </div>

      <table className="proj-permits">
        <colgroup>
          <col className="col-name" />
          <col className="col-issued" />
          <col className="col-expires" />
          <col className="col-bar" />
          <col className="col-status" />
        </colgroup>
        <thead>
          <tr>
            <th>Permit</th>
            <th>Issued</th>
            <th>Expires</th>
            <th>Lifecycle</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {group.permits.map((p) => (
            <tr
              key={p.id}
              className={p.status}
              onClick={() => window.open(taskUrl(p.id), '_blank', 'noopener')}
            >
              <td>
                <div className="permit-name">{p.name}</div>
              </td>
              <td>{shortDate(p.filingDate)}</td>
              <td>{shortDate(p.expirationDate)}</td>
              <td>
                {p.lifecyclePct == null ? (
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>
                    —
                  </span>
                ) : (
                  <>
                    <div className="life-bar">
                      <div className="fill" style={{ width: `${p.lifecyclePct}%` }} />
                    </div>
                    <div className="life-label">
                      {p.lifecyclePct}% used
                      {p.daysLeft != null
                        ? p.daysLeft < 0
                          ? ` · ${Math.abs(p.daysLeft)}d overdue`
                          : ` · ${p.daysLeft}d left`
                        : ''}
                    </div>
                  </>
                )}
              </td>
              <td className="status-cell">
                <span className="pill">
                  <span className="dot-mini" />
                  {statusLabel(p)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
