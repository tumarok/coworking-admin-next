import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MemberDetails } from '@/features/members/components/member-details';
import { isEntityId } from '@/lib/route-params';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Member' };

export default async function MemberPage({ params }: PageProps<'/members/[id]'>) {
  await verifySession();
  const { id } = await params;
  // A malformed id cannot name a record: no request to the API for it.
  if (!isEntityId(id)) notFound();
  return <MemberDetails id={id} />;
}
