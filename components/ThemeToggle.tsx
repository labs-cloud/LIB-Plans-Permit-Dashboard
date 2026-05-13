'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function readInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(readInitial());
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem('libTheme', next);
    } catch {
      /* ignore (Safari private mode) */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background-secondary)',
        border: '0.5px solid var(--color-border-tertiary)',
        cursor: 'pointer',
        color: 'var(--color-text-primary)',
      }}
    >
      <i
        className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`}
        style={{ fontSize: 18 }}
      />
    </button>
  );
}
