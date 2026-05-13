import type { StatusKey } from '@/lib/types';
import { PLAN_STATUS_TABLE } from '@/lib/status-map';

interface Props {
  status: StatusKey | null;
  label?: string;
}

export function StatusPill({ status, label }: Props) {
  const meta = status ? PLAN_STATUS_TABLE[status] : null;
  return (
    <span
      className="pill"
      style={{
        background: meta?.bg ?? 'var(--color-background-secondary)',
        color: meta?.fg ?? 'var(--color-text-secondary)',
        border: meta ? `1px solid ${meta.border}` : '1px solid var(--color-border-tertiary)',
      }}
    >
      {label ? <strong>{label}</strong> : null} {meta?.label ?? '—'}
    </span>
  );
}
