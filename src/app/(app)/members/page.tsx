import type { Metadata } from 'next';
import { MembersList } from '@/features/members/components/members-list';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersPage() {
  await verifySession();
  return <MembersList />;
}
