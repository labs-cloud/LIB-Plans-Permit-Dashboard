import { NextResponse } from 'next/server';
import { getTask, hasClickUpToken } from '@/lib/clickup';

export const runtime = 'nodejs';

// Diagnostic-only endpoint. Hits ClickUp's /task/{id} (single-task endpoint,
// which always returns full custom-field values) and returns the task's
// custom_fields raw so we can see whether a given field has its value set
// or is coming back null.
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  if (!hasClickUpToken()) {
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN not set' }, { status: 503 });
  }
  const url = new URL(req.url);
  const taskId = url.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId query param required' }, { status: 400 });
  }
  try {
    const task = await getTask(taskId);
    return NextResponse.json(
      {
        id: task.id,
        name: task.name,
        status: task.status,
        list: task.list,
        folder: task.folder,
        url: task.url,
        custom_fields: task.custom_fields,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
