import type { Metadata } from 'next';
import { LocationsList } from '@/features/locations/components/locations-list';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Locations' };

export default async function LocationsPage() {
  await verifySession();
  return <LocationsList />;
}
