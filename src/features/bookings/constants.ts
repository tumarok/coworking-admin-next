import {
  BOOKING_STATUSES,
  type BookingStatus,
  type BulkBookingAction,
} from '@/lib/contract/booking';
import { isoDateSchema } from '@/lib/contract/common';
import type { Location } from '@/lib/contract/location';
import { memberFullName, type Member } from '@/lib/contract/member';
import type { Room } from '@/lib/contract/room';
import { humanize } from '@/lib/humanize';

export const STATUS_OPTIONS = BOOKING_STATUSES.map((value) => ({ value, label: humanize(value) }));

/** Filter keys of the list, in the URL next to `page`, `limit` and `q`. */
export const FILTER_KEYS = ['from', 'to', 'status', 'locationId', 'roomId', 'memberId'] as const;

const isCalendarDate = (value: string) => isoDateSchema.safeParse(value).success;

/**
 * `from` and `to` are UTC days, as the API reads them (`[from 00:00Z, to 24:00Z)` on `startsAt`).
 * The times printed on screen are the location's clock, so a booking early in the morning east of
 * UTC sits under the previous UTC day in this filter.
 *
 * What each filter accepts; other values in the URL count as no filter. Ids are any text: the API
 * owns the records, so an unknown one simply finds no bookings.
 */
export const FILTER_VALUES = {
  from: isCalendarDate,
  to: isCalendarDate,
  status: BOOKING_STATUSES,
} as const;

/** What the API prints for the name of a room or member that no longer exists. */
const DELETED_NAME = '—';

/** Whether the API found no record behind a name it computes (a room or member deleted since). */
export const isDeleted = (name: string) => name === DELETED_NAME;

export const roomText = (name: string) => (isDeleted(name) ? 'Deleted room' : name);
export const locationText = (name: string) => (isDeleted(name) ? 'Deleted location' : name);
export const memberText = (name: string) => (isDeleted(name) ? 'Deleted member' : name);

export const roomLabel = (room: Room) =>
  `${room.name} · ${room.locationName} (${room.capacity} seats)`;
export const memberLabel = (member: Member) => `${memberFullName(member)} · ${member.email}`;
export const locationOptionLabel = (location: Location) => `${location.name} (${location.city})`;

/** Button of a status change on a booking: label, look, and whether it asks first. */
export interface StatusAction {
  label: string;
  variant: 'default' | 'outline' | 'destructive';
  /** Asks "Cancel this booking?" before the request. */
  confirm: boolean;
}

export const STATUS_ACTIONS: Record<Exclude<BookingStatus, 'pending'>, StatusAction> = {
  confirmed: { label: 'Confirm', variant: 'default', confirm: false },
  checked_in: { label: 'Check in', variant: 'default', confirm: false },
  completed: { label: 'Complete', variant: 'default', confirm: false },
  no_show: { label: 'No-show', variant: 'outline', confirm: false },
  cancelled: { label: 'Cancel booking', variant: 'destructive', confirm: true },
};

/** What a bulk action did, for the messages: "2 bookings confirmed". */
export const BULK_DONE: Record<BulkBookingAction, string> = {
  confirm: 'confirmed',
  cancel: 'cancelled',
};

/** "1 booking", "2 bookings". */
export const bookingCount = (count: number) => `${count} ${count === 1 ? 'booking' : 'bookings'}`;

/** What the API says of an id it has no booking for; the booking is gone, not merely refused. */
export const NOT_FOUND_REASON = 'Booking not found';
