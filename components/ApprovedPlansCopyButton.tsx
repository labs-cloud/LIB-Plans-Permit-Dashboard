'use client';

import { useState } from 'react';
import { APPROVED_PLANS_LINK } from '@/lib/constants';

interface Props {
  variant?: 'pill' | 'icon';
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through to legacy path */
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

export function ApprovedPlansCopyButton({ variant = 'pill' }: Props) {
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
          color: copied ? '#3B6D11' : '#F47832',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ fontSize: 14 }} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="pill"
      title={copied ? 'Copied to clipboard' : 'Copy Approved Plans Link to clipboard'}
      style={{
        background: copied ? '#EAF3DE' : '#FEF1E5',
        color: copied ? '#173404' : '#7A3A11',
        border: `1px solid ${copied ? '#7FAE52' : '#F47832'}`,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <i
        className={`ti ${copied ? 'ti-check' : 'ti-copy'}`}
        style={{ fontSize: 12, verticalAlign: -1, marginRight: 4 }}
      />
      {copied ? 'Copied!' : 'Copy Approved Plans Link'}
    </button>
  );
}
