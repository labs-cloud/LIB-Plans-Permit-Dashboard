import type { CoordinatorId } from '@/lib/constants';
import { COORD_BY_ID } from '@/lib/constants';

interface Props {
  coord: CoordinatorId;
  size?: number;
  fontSize?: number;
  title?: string;
}

export function CoordinatorAvatar({ coord, size = 24, fontSize = 10, title }: Props) {
  const meta = COORD_BY_ID[coord];
  const cls =
    coord === 'faigy' ? 'avatar-faigy' : coord === 'malky' ? 'avatar-malky' : 'avatar-unassigned';
  return (
    <span
      className={`avatar ${cls}`}
      style={{ width: size, height: size, fontSize }}
      title={title ?? meta.name}
    >
      {meta.initials}
    </span>
  );
}
