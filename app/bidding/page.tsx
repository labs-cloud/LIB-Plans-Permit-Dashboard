import { Suspense } from 'react';
import { BiddingDashboard } from '@/components/BiddingDashboard';
import { DashboardSkeleton } from '@/components/Skeleton';

export const metadata = {
  title: 'Bidding Dashboard · Lead It Builders',
  description: 'Trade × subcontractor bidding status across the active portfolio.',
};

export default function Page() {
  return (
    <main className="dashboard-main">
      <Suspense fallback={<DashboardSkeleton />}>
        <BiddingDashboard />
      </Suspense>
    </main>
  );
}
