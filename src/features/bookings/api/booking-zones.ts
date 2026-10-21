import { useQuery } from '@tanstack/react-query';
import { locationsQuery } from '@/features/bookings/api/booking-queries';

/**
 * Time zones of the locations. A booking carries its location's id but not its zone, and every
 * time on screen is the clock of that location. `ready` is true once the locations answered, with
 * data or with a failure; `zoneOf` is then `undefined` for a location that is gone or unreadable,
 * and the screens fall back to UTC and say so.
 */
export const useLocationZones = () => {
  const locations = useQuery(locationsQuery());
  const zones = new Map((locations.data?.items ?? []).map((l) => [l.id, l.timezone]));
  return {
    locations: locations.data?.items,
    ready: !locations.isPending,
    zoneOf: (locationId: string): string | undefined => zones.get(locationId),
  };
};
