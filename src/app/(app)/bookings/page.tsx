import type { Metadata } from 'next';
import { BookingsList } from '@/features/bookings/components/bookings-list';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Bookings' };

export default async function BookingsPage() {
  await verifySession();
  return <BookingsList />;
}
