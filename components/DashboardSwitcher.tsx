'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Option {
  id: 'budget' | 'bidding' | 'plans' | 'permits';
  href: string;
  label: string;
  icon: string;
  hint: string;
}

const OPTIONS: Option[] = [
  {
    id: 'budget',
    href: '/budget',
    label: 'Budget dashboard',
    icon: 'ti-wallet',
    hint: 'Estimated vs committed · variance · per-project drill-in',
  },
  {
    id: 'bidding',
    href: '/bidding',
    label: 'Bidding dashboard',
    icon: 'ti-gavel',
    hint: 'Trade × sub matrix · 8-color palette',
  },
  {
    id: 'plans',
    href: '/',
    label: 'Plans dashboard',
    icon: 'ti-file-text',
    hint: 'Portfolio · filings · matrix',
  },
  {
    id: 'permits',
    href: '/permits',
    label: 'Permits dashboard',
    icon: 'ti-license',
    hint: 'Expiration calendar · upcoming',
  },
];

// Extract the project segment from the current path, e.g.
// "/bidding/3930%20Carpenter" → "3930%20Carpenter"
function extractProjectSegment(path: string): string | null {
  const m = path.match(/^\/(?:budget|bidding)\/([^/]+)/);
  return m ? m[1] : null;
}

export function DashboardSwitcher() {
  const pathname = usePathname() ?? '/';
  const activeId: Option['id'] = pathname.startsWith('/budget') ? 'budget' : pathname.startsWith('/bidding') ? 'bidding' : pathname.startsWith('/permits') ? 'permits' : 'plans';
  const active = OPTIONS.find((o) => o.id === activeId)!;

  // If we're on a per-project page, carry the project over to budget/bidding.
  const projectSegment = extractProjectSegment(pathname);
  function hrefFor(opt: Option): string {
    if (projectSegment && (opt.id === 'budget' || opt.id === 'bidding')) {
      return `/${opt.id}/${projectSegment}`;
    }
    return opt.href;
  };

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Switch dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 12px',
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          fontSize: 12.5,
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <i className={`ti ${active.icon}`} style={{ fontSize: 14 }} />
        <span>{active.label}</span>
        <i
          className={`ti ti-chevron-${open ? 'up' : 'down'}`}
          style={{ fontSize: 12, opacity: 0.6 }}
        />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 50,
            minWidth: 240,
            padding: 6,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-tertiary)',
              fontWeight: 600,
              padding: '8px 8px 6px',
            }}
          >
            Switch dashboard
          </div>
          {OPTIONS.map((opt) => {
            const isActive = opt.id === activeId;
            return (
              <Link
                key={opt.id}
                href={hrefFor(opt)}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 8px',
                  background: isActive ? 'var(--color-background-secondary)' : 'transparent',
                  borderRadius: 6,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <i
                  className={`ti ${opt.icon}`}
                  style={{
                    fontSize: 16,
                    color: isActive ? 'var(--lib-orange)' : 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 500,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    {opt.hint}
                  </span>
                </span>
                {isActive && (
                  <i
                    className="ti ti-check"
                    style={{
                      fontSize: 14,
                      color: 'var(--lib-orange)',
                      flexShrink: 0,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
