'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KpiStripData, Project } from '@/lib/types';
import { PLAN_STATUS_TABLE } from '@/lib/status-map';
import { folderUrl, taskUrl } from '@/lib/urls';
import { COORD_BY_ID } from '@/lib/constants';
import { CoordinatorAvatar } from './CoordinatorAvatar';

type KpiKey = 'filingsInFlight' | 'approved7d' | 'waitingOn' | 'expiring30d' | 'expired';

interface KpiItem {
  taskId: string;
  projectName: string;
  projectFolderId: string;
  label: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  statusBorder: string;
  coord: Project['coord'];
}

const DAY = 24 * 60 * 60 * 1000;

function bucketItems(projects: Project[], key: KpiKey, now: number): KpiItem[] {
  const items: KpiItem[] = [];
  for (const project of projects) {
    if (key === 'filingsInFlight' || key === 'approved7d' || key === 'waitingOn') {
      for (const plan of project.plans) {
        const match =
          (key === 'filingsInFlight' &&
            (plan.status === 'FI' || plan.status === 'WO' || plan.status === 'TF')) ||
          (key === 'approved7d' && plan.status === 'AP' && now - plan.dateUpdated <= 7 * DAY) ||
          (key === 'waitingOn' && plan.status === 'WO');
        if (!match) continue;
        const style = plan.status ? PLAN_STATUS_TABLE[plan.status] : null;
        items.push({
          taskId: plan.id,
          projectName: project.name,
          projectFolderId: project.folderId,
          label: plan.matrixColumn ?? plan.planType ?? plan.name,
          statusLabel: style?.label ?? plan.rawStatus ?? '—',
          statusColor: style?.fg ?? '#5F5E5A',
          statusBg: style?.bg ?? '#F1EFE8',
          statusBorder: style?.border ?? '#C7C3B5',
          coord: project.coord,
        });
      }
    } else {
      for (const permit of project.permits) {
        const match =
          (key === 'expired' && permit.status === 'expired') ||
          (key === 'expiring30d' && permit.status === 'expiring');
        if (!match) continue;
        const days = permit.daysToExpiration;
        const statusLabel =
          permit.status === 'expired'
            ? days != null
              ? `Expired ${Math.abs(days)}d ago`
              : 'Expired'
            : days != null
              ? `Expires in ${days}d`
              : 'Expiring';
        items.push({
          taskId: permit.id,
          projectName: project.name,
          projectFolderId: project.folderId,
          label: permit.permitType ?? permit.name,
          statusLabel,
          statusColor: permit.status === 'expired' ? '#791F1F' : '#BA7517',
          statusBg: permit.status === 'expired' ? '#FCEBEB' : '#FAEEDA',
          statusBorder: permit.status === 'expired' ? '#F09595' : '#F2B048',
          coord: project.coord,
        });
      }
    }
  }
  return items.sort(
    (a, b) => a.projectName.localeCompare(b.projectName) || a.label.localeCompare(b.label),
  );
}

interface CardSpec {
  key: KpiKey;
  label: string;
  valueColor?: string;
  iconClass: string;
  iconTint: string;
}

const CARDS: CardSpec[] = [
  { key: 'filingsInFlight', label: 'Filings in flight', iconClass: 'ti-file-text', iconTint: '#185fa5' },
  { key: 'approved7d', label: 'Approved · 7d', valueColor: '#173404', iconClass: 'ti-circle-check', iconTint: '#3B6D11' },
  { key: 'waitingOn', label: 'Waiting on', valueColor: '#854F0B', iconClass: 'ti-clock-pause', iconTint: '#BA7517' },
  { key: 'expiring30d', label: 'Expiring · 30d', valueColor: '#854F0B', iconClass: 'ti-alert-triangle', iconTint: '#BA7517' },
  { key: 'expired', label: 'Expired · stop work', valueColor: '#791F1F', iconClass: 'ti-alert-octagon', iconTint: '#A32D2D' },
];

interface KpiCardProps {
  spec: CardSpec;
  value: number;
  onOpen: () => void;
}

function KpiCard({ spec, value, onOpen }: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={value === 0}
      title={value === 0 ? 'No items' : `Click to see all ${value}`}
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        border: '0.5px solid transparent',
        cursor: value === 0 ? 'not-allowed' : 'pointer',
        opacity: value === 0 ? 0.6 : 1,
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (value === 0) return;
        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{spec.label}</div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 500,
            color: spec.valueColor,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: `${spec.iconTint}1A`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <i className={`ti ${spec.iconClass}`} style={{ fontSize: 22, color: spec.iconTint }} />
      </div>
    </button>
  );
}

interface KpiModalProps {
  title: string;
  items: KpiItem[];
  onClose: () => void;
}

function KpiModal({ title, items, onClose }: KpiModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '8vh',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-background-primary)',
          color: 'var(--color-text-primary)',
          width: 'min(640px, 92vw)',
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--border-radius-lg)',
          border: '0.5px solid var(--color-border-tertiary)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {items.length} item{items.length === 1 ? '' : 's'} · click any row to open the task in
              ClickUp
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-background-secondary)',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              border: 'none',
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 8 }}>
          {items.length === 0 ? (
            <div className="empty-state">Nothing in this bucket right now.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((item) => (
                <li key={item.taskId}>
                  <a
                    href={taskUrl(item.taskId)}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 'var(--border-radius-md)',
                      color: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-background-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <CoordinatorAvatar coord={item.coord} size={24} fontSize={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.projectName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label} ·{' '}
                        <span style={{ color: COORD_BY_ID[item.coord].color }}>
                          {COORD_BY_ID[item.coord].name}
                        </span>
                      </div>
                    </div>
                    <span
                      className="pill"
                      style={{
                        background: item.statusBg,
                        color: item.statusColor,
                        border: `1px solid ${item.statusBorder}`,
                        flexShrink: 0,
                      }}
                    >
                      {item.statusLabel}
                    </span>
                    <a
                      href={folderUrl(item.projectFolderId)}
                      target="_blank"
                      rel="noopener"
                      title={`Open ${item.projectName} folder`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: 'var(--color-text-tertiary)',
                        flexShrink: 0,
                        display: 'inline-flex',
                      }}
                    >
                      <i className="ti ti-external-link" style={{ fontSize: 14 }} />
                    </a>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  data: KpiStripData;
  projects: Project[];
}

export function KpiStrip({ data, projects }: Props) {
  const [openKey, setOpenKey] = useState<KpiKey | null>(null);

  const items = useMemo(
    () => (openKey ? bucketItems(projects, openKey, Date.now()) : []),
    [openKey, projects],
  );
  const openSpec = openKey ? CARDS.find((c) => c.key === openKey) : null;

  return (
    <>
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
          marginBottom: '1.25rem',
        }}
      >
        {CARDS.map((spec) => (
          <KpiCard
            key={spec.key}
            spec={spec}
            value={data[spec.key]}
            onOpen={() => setOpenKey(spec.key)}
          />
        ))}
      </div>
      {openSpec && (
        <KpiModal title={openSpec.label} items={items} onClose={() => setOpenKey(null)} />
      )}
    </>
  );
}
