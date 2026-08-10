/**
 * Copy text to the clipboard, falling back to the legacy execCommand path.
 *
 * The dashboard runs inside a ClickUp iframe, where the async Clipboard API is
 * unavailable or permission-denied often enough that the fallback is not
 * optional. Resolves false when both paths fail, so callers can say so rather
 * than flash "Copied!" over nothing.
 */
export function copyText(text: string): Promise<boolean> {
  const execFallback = (): boolean => {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  };

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => execFallback(),
    );
  }
  return Promise.resolve(execFallback());
}
