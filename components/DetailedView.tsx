'use client';

import type { PermitsPanelData, Project } from '@/lib/types';
import { ProjectCard } from './ProjectCard';
import { PermitsPanel } from './PermitsPanel';
import { SortChips, type SortKey } from './SortChips';

interface Props {
  projects: Project[];
  permits: PermitsPanelData;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}

export function DetailedView({ projects, permits, sort, onSortChange }: Props) {
  return (
    <div>
      <SortChips sort={sort} onSortChange={onSortChange} />
      <div className="scrollable">
        {projects.length === 0 ? (
          <div className="empty-state">No projects match these filters</div>
        ) : (
          projects.map((project) => <ProjectCard key={project.folderId} project={project} />)
        )}
      </div>
      <PermitsPanel data={permits} />
    </div>
  );
}
