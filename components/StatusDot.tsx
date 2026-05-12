import type { StatusKey } from '@/lib/types';
import { PLAN_STATUS_TABLE } from '@/lib/status-map';

interface Props {
  status: StatusKey | null;
  size?: number;
  title?: string;
}

export function StatusDot({ status, size = 16, title }: Props) {
  if (!status) {
    return (
      <span
        className="dot"
        style={{
          width: size,
          height: size,
          background: 'var(--color-background-secondary)',
          border: '0.5px dashed var(--color-border-secondary)',
        }}
        title={title ?? 'None'}
      />
    );
  }
  const meta = PLAN_STATUS_TABLE[status];
  const border = status === 'TS' ? '0.5px solid #D3D1C7' : undefined;
  return (
    <span
      className="dot"
      style={{ width: size, height: size, background: meta.bg, border }}
      title={title ?? meta.label}
    />
  );
}
