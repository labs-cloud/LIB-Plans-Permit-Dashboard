'use client';

import { useState } from 'react';
import { APPROVED_PLANS_LINK } from '@/lib/constants';

interface Props {
  variant?: 'button' | 'icon';
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through */
  }
  // Legacy fallback for non-secure contexts (e.g. ClickUp's iframe sometimes
  // strips clipboard permissions). Hidden textarea + execCommand still works.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

const MONO_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

export function ApprovedPlansCopyButton({ variant = 'button' }: Props) {
  const [copied, setCopied] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await copyText(APPROVED_PLANS_LINK);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handle}
        title={copied ? 'Copied!' : 'Copy Approved Plans Link'}
        aria-label={copied ? 'Copied' : 'Copy Approved Plans Link'}
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          background: copied ? '#3B6D11' : '#F47832',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'background 0.15s ease',
        }}
      >
        <i
          className={`ti ${copied ? 'ti-check' : 'ti-clipboard'}`}
          style={{ fontSize: 14, lineHeight: 1 }}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      title={copied ? 'Copied to clipboard' : 'Copy Approved Plans Link to clipboard'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: '0 10px',
        borderRadius: 4,
        background: copied ? '#3B6D11' : '#F47832',
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
        fontFamily: MONO_FONT,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        transition: 'background 0.15s ease',
      }}
    >
      <i
        className={`ti ${copied ? 'ti-check' : 'ti-clipboard'}`}
        style={{ fontSize: 13, lineHeight: 1 }}
      />
      {copied ? 'Copied' : 'Copy plans link'}
    </button>
  );
}
