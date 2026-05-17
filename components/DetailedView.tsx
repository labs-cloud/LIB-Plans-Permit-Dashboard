'use client';

import type { PermitsPanelData, Project } from '@/lib/types';
import { permitsSearchUrl } from '@/lib/urls';
import { ProjectCard } from './ProjectCard';
import { SortChips, type SortKey } from './SortChips';

interface Props {
  projects: Project[];
  permits: PermitsPanelData;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}

export function DetailedView({ projects, permits, sort, onSortChange }: Props) {
  const permitsHref = permitsSearchUrl(permits.allPermitsListIds);
  const permitsCount = permits.active + permits.expiring30d + permits.expired;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SortChips sort={sort} onSortChange={onSortChange} />
        </div>
        <a
          href={permitsHref}
          target="_blank"
          rel="noopener"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--lib-softblack)',
            color: '#fff',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 13,
            fontWeight: 500,
            flexShrink: 0,
          }}
          title="Open the full permits view in ClickUp"
        >
          <i className="ti ti-license" style={{ fontSize: 15 }} />
          Permits dashboard
          {permitsCount > 0 && (
            <span
              style={{
                background: 'var(--lib-orange)',
                color: '#000',
                fontSize: 11,
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: 999,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {permitsCount}
            </span>
          )}
          <i className="ti ti-arrow-up-right" style={{ fontSize: 14, opacity: 0.7 }} />
        </a>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {projects.length === 0 ? (
          <div className="empty-state">No projects match these filters</div>
        ) : (
          projects.map((project) => <ProjectCard key={project.folderId} project={project} />)
        )}
      </div>
    </div>
  );
}
