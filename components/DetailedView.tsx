'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
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

  // Two-finger pinch zooms through three density stops:
  //   D (compact stoplight) → C (grouped lanes) → A (every chip visible).
  // macOS Chrome/Firefox surface pinch as a wheel event with ctrlKey=true;
  // Safari surfaces it as a non-standard gesturechange event. Listen for
  // both, and bind to window so the gesture works anywhere on the page.
  const ZOOM_STOPS: DetailedLayout[] = ['D', 'C', 'A'];
  const ZOOM_LABEL: Record<DetailedLayout, string> = {
    A: 'Plans',
    B: 'Plans',
    C: 'Grouped',
    D: 'Status',
  };

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  useEffect(() => {
    const stepZoom = (direction: 1 | -1) => {
      const cur = layoutRef.current === 'B' ? 'A' : layoutRef.current;
      const idx = ZOOM_STOPS.indexOf(cur);
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= ZOOM_STOPS.length) return;
      onLayoutChangeRef.current(ZOOM_STOPS[nextIdx]);
    };

    let wheelAccum = 0;
    const WHEEL_THRESHOLD = 25;
    let lastFiredAt = 0;
    const COOLDOWN_MS = 250;

    const fire = (direction: 1 | -1) => {
      const now = Date.now();
      if (now - lastFiredAt < COOLDOWN_MS) return;
      lastFiredAt = now;
      stepZoom(direction);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
      // deltaY > 0 = fingers come together (zoom out); < 0 = fingers spread.
      fire(wheelAccum > 0 ? -1 : 1);
      wheelAccum = 0;
    };

    // Safari trackpad gesture API
    let gestureScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ev = e as unknown as { scale: number };
      const scale = ev.scale ?? 1;
      // Step once per 15% scale change.
      if (scale / gestureScale >= 1.15) {
        fire(1);
        gestureScale = scale;
      } else if (scale / gestureScale <= 1 / 1.15) {
        fire(-1);
        gestureScale = scale;
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('gesturestart', onGestureStart as EventListener, { passive: false });
    window.addEventListener('gesturechange', onGestureChange as EventListener, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('gesturestart', onGestureStart as EventListener);
      window.removeEventListener('gesturechange', onGestureChange as EventListener);
    };
    // Stops are static; refs keep the handler reading the latest layout.
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
        <Link
          href="/permits"
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
          title="Open the permits dashboard"
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
          <i className="ti ti-arrow-right" style={{ fontSize: 14, opacity: 0.7 }} />
        </Link>
        <a
          href={permitsHref}
          target="_blank"
          rel="noopener"
          title="Open permits in ClickUp"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 'var(--border-radius-md)',
            border: '0.5px solid var(--color-border-secondary)',
            color: 'var(--color-text-secondary)',
            flexShrink: 0,
          }}
        >
          <i className="ti ti-external-link" style={{ fontSize: 14 }} />
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
