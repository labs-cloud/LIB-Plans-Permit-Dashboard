import { Suspense } from 'react';
import { headers } from 'next/headers';
import { BudgetDashboard } from '@/components/BudgetDashboard';
import { DashboardSkeleton } from '@/components/Skeleton';
import { SCOPE_HEADER, TEAM_SCOPE } from '@/lib/access';

export const metadata = {
  title: 'Budget Dashboard · Lead It Builders',
  description: 'Per-trade budget variance for a single project.',
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // Set by the access gate. Anything other than the team scope means the viewer
  // holds a single-project share link and must not be offered the portfolio.
  const scope = (await headers()).get(SCOPE_HEADER);
  const scoped = scope !== null && scope !== TEAM_SCOPE;

  return (
    <main className="dashboard-main">
      <Suspense fallback={<DashboardSkeleton />}>
        <BudgetDashboard projectId={decodeURIComponent(projectId)} scoped={scoped} />
      </Suspense>
    </main>
  );
}
