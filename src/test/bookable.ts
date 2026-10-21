import type { BookingInput } from '@/lib/contract/booking';
import { zonedToUtcIso } from '@/lib/timezone';
import type { installMockApi } from '@/test/mock-api';

type MockApi = ReturnType<typeof installMockApi>;

/** A day after the seeded bookings, so a booking made there collides with nothing. */
export const FREE_DAY = '2027-06-15';

/**
 * A room anyone can book (available, in an open location), a member who may book, and the request
 * body for `hours` starting at `start` local time on `FREE_DAY` in the room's zone.
 */
export const bookable = (
  api: MockApi,
  {
    start = '09:00',
    hours = 1,
    locationId,
  }: { start?: string; hours?: number; locationId?: string } = {},
) => {
  const room = api.db.rooms.find(
    (r) =>
      r.status === 'available' &&
      r.capacity >= 4 &&
      (locationId === undefined || r.locationId === locationId) &&
      api.db.locations.find((l) => l.id === r.locationId)?.status === 'active',
  );
  const member = api.db.members.find((m) => m.status === 'active');
  const location = api.db.locations.find((l) => l.id === room?.locationId);
  if (!room || !member || !location) throw new Error('the seed has nothing to book');
  const startsAt = zonedToUtcIso(FREE_DAY, start, location.timezone);
  const endsAt = new Date(Date.parse(startsAt) + hours * 3_600_000).toISOString();
  const input: BookingInput = {
    roomId: room.id,
    memberId: member.id,
    startsAt,
    endsAt,
    attendees: 2,
    notes: null,
  };
  return { room, member, location, input };
};
