import { Suspense } from 'react';
import { PermitsDashboard } from '@/components/PermitsDashboard';
import { DashboardSkeleton } from '@/components/Skeleton';
import { getDashboardPayload } from '@/lib/cache';

export const revalidate = 60;

export const metadata = {
  title: 'Permits Dashboard · Lead It Builders',
  description: 'Calendar view of permit expirations across the active portfolio.',
};

export default function Page() {
  return (
    <main className="dashboard-main">
      <Suspense fallback={<DashboardSkeleton />}>
        <PermitsLoader />
      </Suspense>
    </main>
  );
}

async function PermitsLoader() {
  let initial = null;
  let error: string | null = null;
  try {
    initial = await getDashboardPayload();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return <PermitsDashboard initial={initial} initialError={error} />;
}
