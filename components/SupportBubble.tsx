'use client';

import { useEffect, useRef, useState } from 'react';
import { ScreenshotEditor } from './ScreenshotEditor';

type Mode = 'menu' | 'issue' | 'feature';
type Status = 'idle' | 'sending' | 'sent' | 'error';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const ACCEPTED = 'image/png,image/jpeg,image/gif,image/webp';

export function SupportBubble() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hoverHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || editing) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, editing]);

  const showHover = () => {
    if (hoverHideTimer.current) clearTimeout(hoverHideTimer.current);
    setHover(true);
  };
  const hideHoverSoon = () => {
    if (hoverHideTimer.current) clearTimeout(hoverHideTimer.current);
    hoverHideTimer.current = setTimeout(() => setHover(false), 180);
  };

  const reset = () => {
    setMode('menu');
    setMessage('');
    setFiles([]);
    setStatus('idle');
    setError(null);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next: File[] = [...files];
    let total = next.reduce((acc, f) => acc + f.size, 0);
    for (const f of Array.from(incoming)) {
      if (!f.type.startsWith('image/')) {
        setError(`"${f.name}" is not an image.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" is larger than 8 MB.`);
        continue;
      }
      if (total + f.size > MAX_TOTAL_BYTES) {
        setError('Total attachments would exceed 20 MB.');
        break;
      }
      next.push(f);
      total += f.size;
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const addBlobAsFile = (blob: Blob) => {
    let total = files.reduce((acc, f) => acc + f.size, 0);
    if (blob.size > MAX_FILE_BYTES) {
      setError('Capture is larger than 8 MB. Crop it down and try again.');
      return false;
    }
    if (total + blob.size > MAX_TOTAL_BYTES) {
      setError('Total attachments would exceed 20 MB.');
      return false;
    }
    const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
    setFiles([...files, file]);
    return true;
  };

  const handleCapture = async () => {
    setError(null);
    setCaptureBusy(true);
    setHidden(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    try {
      const html2canvas = (await import('html2canvas')).default;
      const bodyBg =
        getComputedStyle(document.body).backgroundColor ||
        getComputedStyle(document.documentElement).backgroundColor ||
        '#ffffff';
      const canvas = await html2canvas(document.body, {
        backgroundColor: bodyBg,
        logging: false,
        useCORS: true,
        scale: Math.min(2, window.devicePixelRatio || 1),
      });
      const dataUrl = canvas.toDataURL('image/png');
      setEditing(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed.');
    } finally {
      setHidden(false);
      setCaptureBusy(false);
    }
  };

  const handleEditorDone = (blob: Blob) => {
    addBlobAsFile(blob);
    setEditing(null);
    setOpen(true);
  };

  const quickOpen = (target: Mode) => {
    setMode(target);
    setOpen(true);
    setHover(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'menu') return;
    if (!message.trim()) {
      setError('Please describe the issue or request.');
      return;
    }
    setStatus('sending');
    setError(null);

    const fd = new FormData();
    fd.set('kind', mode);
    fd.set('message', message.trim());
    if (typeof window !== 'undefined') {
      fd.set('pageUrl', window.location.href);
      fd.set('userAgent', navigator.userAgent);
    }
    for (const f of files) fd.append('screenshots', f);

    try {
      const res = await fetch('/api/support', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Send failed (${res.status})`);
      }
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Send failed.');
    }
  };

  const title = mode === 'issue' ? 'Report an issue' : mode === 'feature' ? 'Request a feature' : 'Support';

  return (
    <>
      {editing && (
        <ScreenshotEditor
          imageDataUrl={editing}
          onDone={handleEditorDone}
          onCancel={() => setEditing(null)}
        />
      )}
      <div style={{ display: hidden ? 'none' : 'contents' }}>
      <div
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        <div
          onMouseEnter={showHover}
          onMouseLeave={hideHoverSoon}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10,
            opacity: hover && !open ? 1 : 0,
            transform: hover && !open ? 'translateY(0)' : 'translateY(8px)',
            pointerEvents: hover && !open ? 'auto' : 'none',
            transition: 'opacity 160ms ease, transform 160ms ease',
          }}
        >
          <SubBubble
            icon="ti-bulb"
            label="Request feature"
            onClick={() => quickOpen('feature')}
          />
          <SubBubble
            icon="ti-bug"
            label="Report issue"
            onClick={() => quickOpen('issue')}
          />
        </div>
        <button
          ref={buttonRef}
          type="button"
          aria-label={open ? 'Close support menu' : 'Open support menu'}
          title="Support"
          onMouseEnter={showHover}
          onMouseLeave={hideHoverSoon}
          onClick={() => {
            setOpen((v) => !v);
            if (open) setTimeout(reset, 200);
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--lib-orange)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 120ms ease',
            transform: open ? 'scale(0.94)' : 'scale(1)',
            pointerEvents: 'auto',
          }}
        >
          <i className={`ti ${open ? 'ti-x' : 'ti-help'}`} style={{ fontSize: 22 }} />
        </button>
      </div>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={title}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 80,
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-lg)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
            zIndex: 2000,
            padding: 16,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            {mode !== 'menu' && status !== 'sent' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('menu');
                  setError(null);
                }}
                aria-label="Back"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                  fontSize: 13,
                }}
              >
                <i className="ti ti-chevron-left" style={{ fontSize: 16 }} /> Back
              </button>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: 4,
                lineHeight: 0,
              }}
            >
              <i className="ti ti-x" style={{ fontSize: 16 }} />
            </button>
          </header>

          {mode === 'menu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                How can we help?
              </p>
              <MenuButton
                icon="ti-bug"
                title="Report an issue"
                subtitle="Something looks wrong or broken"
                onClick={() => setMode('issue')}
              />
              <MenuButton
                icon="ti-bulb"
                title="Request a feature"
                subtitle="Suggest an improvement"
                onClick={() => setMode('feature')}
              />
            </div>
          )}

          {(mode === 'issue' || mode === 'feature') && status !== 'sent' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {mode === 'issue' ? 'What went wrong?' : 'What would you like to see?'}
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  required
                  placeholder={
                    mode === 'issue'
                      ? 'Describe the issue, what you expected, and steps to reproduce…'
                      : 'Describe the feature and why it would help…'
                  }
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 96, fontFamily: 'inherit' }}
                />
              </label>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Screenshots ({files.length})
                  </span>
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={handleCapture}
                      disabled={captureBusy}
                      style={{
                        background: 'transparent',
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: captureBusy ? 'wait' : 'pointer',
                        color: 'var(--color-text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: captureBusy ? 0.7 : 1,
                      }}
                    >
                      <i className="ti ti-camera" style={{ fontSize: 14 }} /> Capture screen
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'transparent',
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        color: 'var(--color-text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="ti ti-paperclip" style={{ fontSize: 14 }} /> Attach
                    </button>
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED}
                    multiple
                    onChange={(e) => handleFiles(e.target.files)}
                    style={{ display: 'none' }}
                  />
                </div>
                {files.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                      gap: 6,
                    }}
                  >
                    {files.map((f, i) => (
                      <Thumbnail
                        key={`${f.name}-${i}-${f.size}`}
                        file={f}
                        onRemove={() => removeFile(i)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--danger-fg)',
                    background: 'var(--danger-bg)',
                    padding: '6px 10px',
                    borderRadius: 'var(--border-radius-md)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                style={{
                  marginTop: 4,
                  background: 'var(--lib-orange)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: status === 'sending' ? 'wait' : 'pointer',
                  opacity: status === 'sending' ? 0.7 : 1,
                }}
              >
                {status === 'sending' ? 'Sending…' : mode === 'issue' ? 'Send report' : 'Send request'}
              </button>
            </form>
          )}

          {status === 'sent' && (
            <div style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--good-bg)',
                  color: 'var(--good-strong)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <i className="ti ti-check" style={{ fontSize: 22 }} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Thanks — message sent.</p>
              <p style={{ margin: '4px 0 12px 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                The team will follow up at labs@optentia.com.
              </p>
              <button
                type="button"
                onClick={reset}
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--color-border-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--color-text-primary)',
                }}
              >
                Send another
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}

function SubBubble({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          background: 'rgba(20,20,20,0.88)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 500,
          padding: '4px 8px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        aria-label={label}
        title={label}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--color-background-primary)',
          color: 'var(--lib-orange)',
          border: '0.5px solid var(--color-border-secondary)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
      </button>
    </div>
  );
}

function MenuButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--color-background-secondary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-md)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--color-text-primary)',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--color-background-tertiary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--lib-orange)',
          flexShrink: 0,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{subtitle}</span>
      </span>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Thumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith('image/')) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div
      title={`${file.name} · ${formatBytes(file.size)}`}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        background: 'var(--color-background-tertiary)',
        borderRadius: 'var(--border-radius-md)',
        overflow: 'hidden',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={file.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: 'var(--color-text-tertiary)',
            fontSize: 10,
            padding: 4,
            textAlign: 'center',
          }}
        >
          {file.name}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <i className="ti ti-x" style={{ fontSize: 12 }} />
      </button>
    </div>
  );
}
