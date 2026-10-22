import type { Metadata } from 'next';
import { DashboardView } from '@/features/dashboard/components/dashboard-view';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  await verifySession();
  return <DashboardView />;
}
