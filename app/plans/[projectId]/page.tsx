import { Suspense } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { DashboardSkeleton } from '@/components/Skeleton';
import { getDashboardPayload } from '@/lib/cache';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return {
    title: `${decodeURIComponent(projectId)} · Plans · Lead It Builders`,
    description: 'Plans filing status and matrix for a single project.',
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <main className="dashboard-main">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardLoader projectId={decodeURIComponent(projectId)} />
      </Suspense>
    </main>
  );
}

async function DashboardLoader({ projectId }: { projectId: string }) {
  let initial = null;
  let error: string | null = null;
  try {
    initial = await getDashboardPayload();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return <Dashboard initial={initial} initialError={error} projectId={projectId} />;
}
