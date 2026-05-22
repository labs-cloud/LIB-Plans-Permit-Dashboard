import { NextResponse } from 'next/server';
import { hasClickUpToken } from '@/lib/clickup';

export const runtime = 'nodejs';

interface FollowUpBody {
  taskId?: string;
  subName: string;
  tradeName: string;
  projectName: string;
  folderId?: string;
}

/**
 * POST /api/follow-up
 * Logs a follow-up action for a bidding sub.
 * Optionally posts a ClickUp comment on the bid task with a timestamp.
 * Body: { taskId?, subName, tradeName, projectName, folderId? }
 */
export async function POST(req: Request) {
  if (!hasClickUpToken()) {
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN not set' }, { status: 503 });
  }

  let body: FollowUpBody;
  try {
    body = (await req.json()) as FollowUpBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { taskId, subName, tradeName, projectName } = body;
  if (!subName || !tradeName || !projectName) {
    return NextResponse.json({ error: 'subName, tradeName, and projectName are required' }, { status: 400 });
  }

  // If a ClickUp task ID is provided, post a comment logging the follow-up
  if (taskId) {
    try {
      const token = process.env.CLICKUP_API_TOKEN!;
      const commentText = `[Dashboard] Follow-up sent to ${subName} for ${tradeName} — ${new Date().toISOString()}`;
      const commentRes = await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/comment`, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment_text: commentText }),
      });
      if (!commentRes.ok) {
        const text = await commentRes.text().catch(() => '');
        console.warn(`ClickUp comment failed: ${commentRes.status} ${text.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn('Failed to post ClickUp comment', err);
    }
  }

  return NextResponse.json({ ok: true, at: Date.now() });
}
