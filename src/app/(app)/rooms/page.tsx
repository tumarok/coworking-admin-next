import type { Metadata } from 'next';
import { RoomsList } from '@/features/rooms/components/rooms-list';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Rooms' };

export default async function RoomsPage() {
  await verifySession();
  return <RoomsList />;
}
