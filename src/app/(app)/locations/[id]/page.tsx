import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocationDetails } from '@/features/locations/components/location-details';
import { isEntityId } from '@/lib/route-params';
import { verifySession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Location' };

export default async function LocationPage({ params }: PageProps<'/locations/[id]'>) {
  await verifySession();
  const { id } = await params;
  // A malformed id cannot name a record: no request to the API for it.
  if (!isEntityId(id)) notFound();
  return <LocationDetails id={id} />;
}
