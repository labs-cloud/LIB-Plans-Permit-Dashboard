'use client';

import { useEffect, useRef } from 'react';
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

  // Two-finger pinch on the project list zooms through three density
  // stops: D (compact one-line stoplight) → C (grouped lanes) → A
  // (every chip visible). macOS surfaces trackpad pinch as a `wheel`
  // event with ctrlKey=true, so we listen on the list container and
  // preventDefault to override browser page-zoom.
  const ZOOM_STOPS: DetailedLayout[] = ['D', 'C', 'A'];
  const ZOOM_LABEL: Record<DetailedLayout, string> = {
    A: 'Plans',
    B: 'Plans',
    C: 'Grouped',
    D: 'Status',
  };

  const listRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let accum = 0;
    const THRESHOLD = 40;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // only react to pinch, not regular scroll
      e.preventDefault();
      accum += e.deltaY;
      if (Math.abs(accum) < THRESHOLD) return;
      const cur = layoutRef.current === 'B' ? 'A' : layoutRef.current;
      const idx = ZOOM_STOPS.indexOf(cur);
      // deltaY positive when fingers come together (zoom out);
      // negative when fingers spread apart (zoom in).
      if (accum > 0 && idx > 0) {
        onLayoutChangeRef.current(ZOOM_STOPS[idx - 1]);
      } else if (accum < 0 && idx < ZOOM_STOPS.length - 1) {
        onLayoutChangeRef.current(ZOOM_STOPS[idx + 1]);
      }
      accum = 0;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // Stops are static; ref dance above keeps the handler reading the
    // latest layout and callback without re-binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <span
          title="Pinch with two fingers on the list to zoom in or out"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            padding: '0 10px',
            fontSize: 11.5,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <i className="ti ti-zoom-in-area" style={{ fontSize: 13, opacity: 0.7 }} />
          {ZOOM_LABEL[layout]}
        </span>
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
        ref={listRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          touchAction: 'pan-y pinch-zoom',
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
