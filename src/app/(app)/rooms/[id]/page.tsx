import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RoomDetails } from '@/features/rooms/components/room-details';
import { isEntityId } from '@/lib/route-params';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Room' };

export default async function RoomPage({ params }: PageProps<'/rooms/[id]'>) {
  await verifySession();
  const { id } = await params;
  // A malformed id cannot name a record: no request to the API for it.
  if (!isEntityId(id)) notFound();
  return <RoomDetails id={id} />;
}
