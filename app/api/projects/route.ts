import { NextResponse } from 'next/server';
import { getDashboardPayload } from '@/lib/cache';

export const revalidate = 60;
export const runtime = 'nodejs';

export async function GET() {
  try {
    const payload = await getDashboardPayload();
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message, source: 'error' as const },
      { status: 500 },
    );
  }
}
