import { Suspense } from 'react';
import { BudgetDashboard } from '@/components/BudgetDashboard';
import { DashboardSkeleton } from '@/components/Skeleton';

export const metadata = {
  title: 'Budget Dashboard · Lead It Builders',
  description: 'Per-trade budget variance across the active portfolio.',
};

export default function Page() {
  return (
    <main className="dashboard-main">
      <Suspense fallback={<DashboardSkeleton />}>
        <BudgetDashboard />
      </Suspense>
    </main>
  );
}
