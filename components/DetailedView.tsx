'use client';

import type { PermitsPanelData, Project } from '@/lib/types';
import { permitsSearchUrl } from '@/lib/urls';
import { CompactRow } from './CompactRow';
import { ProjectCard } from './ProjectCard';
import { SortChips, type SortKey } from './SortChips';
import {
  ViewSettings,
  type ChipStyle,
  type DetailedLayout,
} from './ViewSettings';

interface Props {
  projects: Project[];
  permits: PermitsPanelData;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  layout: DetailedLayout;
  chipStyle: ChipStyle;
  onLayoutChange: (l: DetailedLayout) => void;
  onChipStyleChange: (c: ChipStyle) => void;
}

export function DetailedView({
  projects,
  permits,
  sort,
  onSortChange,
  layout,
  chipStyle,
  onLayoutChange,
  onChipStyleChange,
}: Props) {
  const permitsHref = permitsSearchUrl(permits.allPermitsListIds);
  const permitsCount = permits.active + permits.expiring30d + permits.expired;

  // Zoom in/out cycles through three density stops: D (compact one-line
  // stoplight) → C (grouped lanes) → A (every chip visible). B is an
  // alternate ordering of A — treated as fully zoomed-in here.
  const ZOOM_STOPS: DetailedLayout[] = ['D', 'C', 'A'];
  const zoomIndex = Math.max(0, ZOOM_STOPS.indexOf(layout === 'B' ? 'A' : layout));
  const zoomOut = () => {
    if (zoomIndex > 0) onLayoutChange(ZOOM_STOPS[zoomIndex - 1]);
  };
  const zoomIn = () => {
    if (zoomIndex < ZOOM_STOPS.length - 1) onLayoutChange(ZOOM_STOPS[zoomIndex + 1]);
  };
  const ZOOM_LABEL: Record<DetailedLayout, string> = {
    A: 'Plans',
    B: 'Plans',
    C: 'Grouped',
    D: 'Status',
  };

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
        <div
          role="group"
          aria-label="Zoom level"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0,
            height: 30,
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--color-background-primary)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomIndex === 0}
            title="Zoom out — collapse projects to status summary"
            aria-label="Zoom out"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: zoomIndex === 0 ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
              cursor: zoomIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <i className="ti ti-minus" style={{ fontSize: 14 }} />
          </button>
          <span
            style={{
              minWidth: 56,
              textAlign: 'center',
              fontSize: 11.5,
              color: 'var(--color-text-secondary)',
              borderLeft: '0.5px solid var(--color-border-tertiary)',
              borderRight: '0.5px solid var(--color-border-tertiary)',
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {ZOOM_LABEL[layout]}
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomIndex === ZOOM_STOPS.length - 1}
            title="Zoom in — show every plan"
            aria-label="Zoom in"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color:
                zoomIndex === ZOOM_STOPS.length - 1
                  ? 'var(--color-text-tertiary)'
                  : 'var(--color-text-primary)',
              cursor: zoomIndex === ZOOM_STOPS.length - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14 }} />
          </button>
        </div>
        <ViewSettings
          layout={layout}
          chipStyle={chipStyle}
          onLayoutChange={onLayoutChange}
          onChipStyleChange={onChipStyleChange}
        />
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
        ) : layout === 'D' ? (
          projects.map((project) => (
            <CompactRow
              key={project.folderId}
              project={project}
              chipStyle={chipStyle}
            />
          ))
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.folderId}
              project={project}
              layout={layout}
              chipStyle={chipStyle}
            />
          ))
        )}
      </div>
    </div>
  );
}
