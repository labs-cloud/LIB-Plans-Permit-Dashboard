import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { updateTaskCustomField } from '@/lib/clickup';
import { CLICKUP } from '@/lib/constants';
import { BUDGET_CACHE_TAG } from '@/lib/cache';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { taskId?: string; value?: number };
    const { taskId, value } = body;

    if (!taskId || typeof value !== 'number' || !Number.isFinite(value)) {
      return NextResponse.json(
        { error: 'taskId (string) and value (number) are required' },
        { status: 400 },
      );
    }

    await updateTaskCustomField(taskId, CLICKUP.FIELD.UPDATED_BUDGET, value);
    revalidateTag(BUDGET_CACHE_TAG);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
