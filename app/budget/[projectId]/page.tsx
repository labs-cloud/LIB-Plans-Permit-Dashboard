import { Suspense } from 'react';
import { BudgetDashboard } from '@/components/BudgetDashboard';
import { DashboardSkeleton } from '@/components/Skeleton';

export const metadata = {
  title: 'Budget Dashboard · Lead It Builders',
  description: 'Per-trade budget variance for a single project.',
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
        <BudgetDashboard projectId={decodeURIComponent(projectId)} />
      </Suspense>
    </main>
  );
}
