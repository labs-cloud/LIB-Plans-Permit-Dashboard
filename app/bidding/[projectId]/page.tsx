import { Suspense } from 'react';
import { BiddingDashboard } from '@/components/BiddingDashboard';
import { DashboardSkeleton } from '@/components/Skeleton';

export const metadata = {
  title: 'Bidding Dashboard · Lead It Builders',
  description: 'Trade × subcontractor bidding status for a single project.',
};

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <main className="dashboard-main">
      <Suspense fallback={<DashboardSkeleton />}>
        <BiddingDashboard projectId={decodeURIComponent(projectId)} />
      </Suspense>
    </main>
  );
}
