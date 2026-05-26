import { Suspense } from 'react';
import { BiddingReport } from '@/components/BiddingReport';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const name = decodeURIComponent(projectId);
  return {
    title: `${name} · Bidding Report · Lead It Builders`,
    description: `Live bidding status report for ${name}`,
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
      <BiddingReport projectId={decodeURIComponent(projectId)} />
    </Suspense>
  );
}
