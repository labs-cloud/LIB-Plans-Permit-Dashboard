import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

const SUPPORT_ADDRESS = 'labs@optentia.com';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB per file
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB request cap
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

type Kind = 'issue' | 'feature';

function labelFor(kind: Kind) {
  return kind === 'issue' ? 'Issue Report' : 'Feature Request';
}

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Support email is not configured (missing RESEND_API_KEY).' },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  const kindRaw = String(form.get('kind') ?? '');
  const kind: Kind | null = kindRaw === 'issue' || kindRaw === 'feature' ? kindRaw : null;
  if (!kind) {
    return NextResponse.json({ error: 'Field "kind" must be "issue" or "feature".' }, { status: 400 });
  }

  const message = String(form.get('message') ?? '').trim();
  if (!message) {
    return NextResponse.json({ error: 'Please describe the issue or request.' }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: 'Message is too long (max 8000 characters).' }, { status: 400 });
  }

  const pageUrl = String(form.get('pageUrl') ?? '').trim().slice(0, 500);
  const userAgent = String(form.get('userAgent') ?? '').trim().slice(0, 500);

  const screenshots = form.getAll('screenshots').filter((v): v is File => v instanceof File);
  let totalBytes = 0;
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const file of screenshots) {
    if (!file.size) continue;
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported attachment type: ${file.type || 'unknown'}. Use PNG, JPEG, GIF or WEBP.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `Attachment "${file.name}" exceeds the 8 MB per-file limit.` },
        { status: 400 },
      );
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: 'Total attachments exceed the 20 MB limit.' },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    attachments.push({ filename: file.name || 'screenshot.png', content: buf, contentType: file.type });
  }

  const label = labelFor(kind);
  const subject = `[Plans Dashboard] ${label}`;

  const lines = [
    `Type: ${label}`,
    pageUrl ? `Page: ${pageUrl}` : null,
    userAgent ? `User-Agent: ${userAgent}` : null,
    `Submitted: ${new Date().toISOString()}`,
    '',
    '— Message —',
    message,
  ].filter(Boolean);

  const text = lines.join('\n');

  const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1a1a1a;">
      <h2 style="margin:0 0 12px 0;font-size:16px;">${escapeHtml(label)}</h2>
      <table style="border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        ${pageUrl ? `<tr><td style="padding:2px 12px 2px 0;color:#6b6b6b;">Page</td><td><a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></td></tr>` : ''}
        ${userAgent ? `<tr><td style="padding:2px 12px 2px 0;color:#6b6b6b;">Browser</td><td>${escapeHtml(userAgent)}</td></tr>` : ''}
        <tr><td style="padding:2px 12px 2px 0;color:#6b6b6b;">Submitted</td><td>${new Date().toISOString()}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b6b6b;">Attachments</td><td>${attachments.length}</td></tr>
      </table>
      <div style="white-space:pre-wrap;border-left:3px solid #ebeae5;padding:8px 12px;background:#f7f6f3;border-radius:4px;">${escapeHtml(message)}</div>
    </div>
  `;

  const from = process.env.SUPPORT_FROM_EMAIL || `Plans Dashboard <${SUPPORT_ADDRESS}>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: SUPPORT_ADDRESS,
      subject,
      text,
      html,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    if (error) {
      return NextResponse.json({ error: error.message || 'Email send failed.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error sending email.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
