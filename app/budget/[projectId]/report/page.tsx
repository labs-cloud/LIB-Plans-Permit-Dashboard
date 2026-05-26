import { Suspense } from 'react';
import { BudgetReport } from '@/components/BudgetReport';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const name = decodeURIComponent(projectId);
  return {
    title: `${name} · Budget Outlook · Lead It Builders`,
    description: `Live budget outlook report for ${name}`,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <Suspense fallback={null}>
      <BudgetReport projectId={decodeURIComponent(projectId)} />
    </Suspense>
  );
}
