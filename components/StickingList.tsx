import type { StickingItem } from '@/lib/types';
import { taskUrl } from '@/lib/urls';
import { CoordinatorAvatar } from './CoordinatorAvatar';

interface Props {
  items: StickingItem[];
}

export function StickingList({ items }: Props) {
  return (
    <div className="card">
      <div className="section-title">
        <i className="ti ti-flag" style={{ fontSize: 16, color: '#A32D2D' }} /> What&apos;s sticking
      </div>
      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: '1rem' }}>
          All clear for this filter
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item) => (
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
                <strong>{item.projectName}</strong> · {item.text}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
