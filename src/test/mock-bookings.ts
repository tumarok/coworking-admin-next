import type { Booking } from '@/lib/contract/booking';
import { formatTimeRange } from '@/lib/format-date';
import { toBookingView, type installMockApi } from '@/test/mock-api';

type MockApi = ReturnType<typeof installMockApi>;

/** A booking as the API prints it: the record plus the names of its room, location and member. */
export const bookingView = (api: MockApi, record: MockApi['db']['bookings'][number]): Booking =>
  toBookingView(api.db, record);

/** The zone a booking is printed in: the one of its room's location. */
export const zoneOf = (api: MockApi, booking: Booking) => {
  const zone = api.db.locations.find((l) => l.id === booking.locationId)?.timezone;
  if (!zone) throw new Error(`the booking ${booking.id} has no location`);
  return zone;
};

/** What the list and the page title print for the time of a booking. */
export const rangeOf = (api: MockApi, booking: Booking) =>
  formatTimeRange(booking.startsAt, booking.endsAt, zoneOf(api, booking));

const find = <T>(label: string, item: T | undefined) => {
  if (item === undefined) throw new Error(`the seed has no booking ${label}`);
  return item;
};

/**
 * Bookings of the seeded data that the tests need, found in the data instead of written down:
 * the first page of the list (latest start first, as the API sorts it) and one booking of each
 * status that matters.
 */
export const seededBookings = (api: MockApi, pageSize = 20) => {
  const all = api.db.bookings
    .map((record) => bookingView(api, record))
    .toSorted((a, b) => b.startsAt.localeCompare(a.startsAt));
  const page = all.slice(0, pageSize);
  // A booking the API lets a user edit and save unchanged: pending or confirmed, in a room that is
  // available, in an open location, for a member who is active.
  const editable = (status: 'pending' | 'confirmed') =>
    page.find((b) => {
      const room = api.db.rooms.find((r) => r.id === b.roomId);
      const location = api.db.locations.find((l) => l.id === b.locationId);
      const member = api.db.members.find((m) => m.id === b.memberId);
      return (
        b.status === status &&
        room?.status === 'available' &&
        location?.status === 'active' &&
        member?.status === 'active'
      );
    });
  return {
    editablePending: find('pending and editable on the first page', editable('pending')),
    editableConfirmed: find('confirmed and editable on the first page', editable('confirmed')),
    all,
    page,
    first: find('on the first page', page[0]),
    pending: find(
      'pending on the first page',
      page.find((b) => b.status === 'pending'),
    ),
    confirmed: find(
      'confirmed on the first page',
      page.find((b) => b.status === 'confirmed'),
    ),
    checkedIn: find(
      'checked in',
      all.find((b) => b.status === 'checked_in'),
    ),
    completed: find(
      'completed',
      all.find((b) => b.status === 'completed'),
    ),
    cancelled: find(
      'cancelled',
      all.find((b) => b.status === 'cancelled'),
    ),
  };
};
