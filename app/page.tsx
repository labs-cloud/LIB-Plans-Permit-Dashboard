import { Suspense } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { DashboardSkeleton } from '@/components/Skeleton';
import { getDashboardPayload } from '@/lib/cache';

export const revalidate = 60;

export default function Page() {
  return (
    <main className="dashboard-main">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardLoader />
      </Suspense>
    </main>
  );
}

async function DashboardLoader() {
  let initial = null;
  let error: string | null = null;
  try {
    initial = await getDashboardPayload();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return <Dashboard initial={initial} initialError={error} />;
}
