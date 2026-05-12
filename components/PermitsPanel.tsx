import type { PermitsPanelData } from '@/lib/types';
import { folderUrl, taskUrl, permitsSearchUrl } from '@/lib/urls';
import { CoordinatorAvatar } from './CoordinatorAvatar';

interface Props {
  data: PermitsPanelData;
}

function timelineBar(count: number, color: string, label: string, max: number) {
  const height = max > 0 ? Math.max(8, Math.round((count / max) * 104)) : 8;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 500 }}>{count}</div>
      <div
        style={{
          width: '100%',
          height,
          background: color,
          borderRadius: '4px 4px 0 0',
        }}
      />
      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{label}</div>
    </div>
  );
}

export function PermitsPanel({ data }: Props) {
  const allPermitsHref = permitsSearchUrl(data.allPermitsListIds);
  const maxBar = Math.max(
    data.timeline.overdue,
    data.timeline.d0_7,
    data.timeline.d8_30,
    data.timeline.d31_60,
    data.timeline.d61_90,
    1,
  );

  return (
    <div>
      <div
        style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '0.5px solid var(--color-border-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="ti ti-license" style={{ fontSize: 20 }} /> Permits dashboard
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Active permits · expiration tracking · agency breakdown
            </div>
          </div>
          <a
            href={allPermitsHref}
            target="_blank"
            rel="noopener"
            style={{ fontSize: 12, color: 'var(--color-text-info)' }}
          >
            View all permits →
          </a>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          margin: '1rem 0',
        }}
      >
        <div
          style={{
            background: '#EAF3DE',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11, color: '#173404' }}>Active permits</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#173404' }}>{data.active}</div>
          <div style={{ fontSize: 11, color: '#3B6D11' }}>
            across {data.activeProjects} project{data.activeProjects === 1 ? '' : 's'}
          </div>
        </div>
        <div
          style={{
            background: '#FAEEDA',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11, color: '#412402' }}>Expiring · 30d</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#412402' }}>{data.expiring30d}</div>
          <div style={{ fontSize: 11, color: '#854F0B' }}>
            on {data.expiring30dProjects} project{data.expiring30dProjects === 1 ? '' : 's'}
          </div>
        </div>
        <div
          style={{
            background: '#FCEBEB',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11, color: '#501313' }}>Expired</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#501313' }}>{data.expired}</div>
          <div style={{ fontSize: 11, color: '#791F1F' }}>stop-work risk</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 14,
          marginBottom: '1rem',
        }}
      >
        <div className="card">
          <div className="section-title">Expiration timeline · next 90 days</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', height: 110 }}>
            {timelineBar(data.timeline.overdue, '#F09595', 'Overdue', maxBar)}
            {timelineBar(data.timeline.d0_7, '#EF9F27', '0–7d', maxBar)}
            {timelineBar(data.timeline.d8_30, '#FAC775', '8–30d', maxBar)}
            {timelineBar(data.timeline.d31_60, '#B5D4F4', '31–60d', maxBar)}
            {timelineBar(data.timeline.d61_90, '#85B7EB', '61–90d', maxBar)}
          </div>
        </div>
        <div className="card">
          <div className="section-title">By agency</div>
          {data.byAgency.length === 0 ? (
            <div className="empty-state" style={{ padding: '0.5rem' }}>
              No agency labels yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.byAgency.map((row) => (
                <div key={row.agency} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: row.color,
                    }}
                  />
                  <div style={{ flex: 1, fontSize: 12 }}>{row.agency}</div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{row.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.attention.length > 0 && (
        <div className="card">
          <div className="section-title">
            <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: '#BA7517' }} /> Needs
            attention
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.attention.map((item) => (
              <a
                key={item.taskId}
                href={taskUrl(item.taskId)}
                target="_blank"
                rel="noopener"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: item.bg,
                  borderRadius: 'var(--border-radius-md)',
                }}
              >
                <CoordinatorAvatar coord={item.coord} size={20} fontSize={9} />
                <div style={{ flex: 1, fontSize: 12, color: item.color }}>
                  <a
                    href={folderUrl(item.folderId)}
                    target="_blank"
                    rel="noopener"
                    style={{ color: 'inherit', fontWeight: 600 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.projectName}
                  </a>{' '}
                  · {item.text}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
