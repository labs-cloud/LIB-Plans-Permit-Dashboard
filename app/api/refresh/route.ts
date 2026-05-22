import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { PROJECTS_CACHE_TAG, BIDDING_CACHE_TAG, BUDGET_CACHE_TAG } from '@/lib/cache';

export const runtime = 'nodejs';

export async function POST() {
  revalidateTag(PROJECTS_CACHE_TAG);
  revalidateTag(BIDDING_CACHE_TAG);
  revalidateTag(BUDGET_CACHE_TAG);
  return NextResponse.json({ revalidated: true, at: Date.now() });
}
