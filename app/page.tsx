import { Suspense } from 'react';
import { getDashboardPayload } from '@/lib/cache';
import { Dashboard } from '@/components/Dashboard';
import { DashboardSkeleton } from '@/components/Skeleton';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function Page() {
  let initial = null;
  let error: string | null = null;
  try {
    initial = await getDashboardPayload();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard initial={initial} initialError={error} />
      </Suspense>
    </main>
  );
}
