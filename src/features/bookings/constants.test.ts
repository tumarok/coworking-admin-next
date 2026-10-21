import { describe, expect, it } from 'vitest';
import { BOOKING_STATUSES, BOOKING_TRANSITIONS } from '@/lib/contract/booking';
import {
  bookingCount,
  BULK_DONE,
  FILTER_VALUES,
  isDeleted,
  locationText,
  memberLabel,
  memberText,
  roomLabel,
  roomText,
  STATUS_ACTIONS,
  STATUS_OPTIONS,
} from './constants';

describe('STATUS_OPTIONS', () => {
  it('lists every status with a readable label', () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([...BOOKING_STATUSES]);
    expect(STATUS_OPTIONS.find((o) => o.value === 'checked_in')?.label).toBe('Checked in');
  });
});

describe('FILTER_VALUES', () => {
  it('accepts a real calendar date and nothing else for the period', () => {
    expect(FILTER_VALUES.from('2026-10-14')).toBe(true);
    expect(FILTER_VALUES.to('2024-02-29')).toBe(true);
    for (const text of ['', 'today', '2026-13-01', '2026-02-30', '14/10/2026']) {
      expect(FILTER_VALUES.from(text)).toBe(false);
    }
  });
});

describe('STATUS_ACTIONS', () => {
  it('has an action for every status a booking can move to, and only cancelling asks first', () => {
    const targets = new Set(Object.values(BOOKING_TRANSITIONS).flat());

    expect(Object.keys(STATUS_ACTIONS).toSorted()).toEqual([...targets].toSorted());
    expect(
      Object.entries(STATUS_ACTIONS)
        .filter(([, a]) => a.confirm)
        .map(([s]) => s),
    ).toEqual(['cancelled']);
  });
});

describe('names of deleted records', () => {
  it('replaces the dash the API prints with a sentence', () => {
    expect(isDeleted('—')).toBe(true);
    expect(isDeleted('Atrium')).toBe(false);
    expect(roomText('—')).toBe('Deleted room');
    expect(locationText('—')).toBe('Deleted location');
    expect(memberText('—')).toBe('Deleted member');
  });

  it('leaves a real name alone', () => {
    expect(roomText('Atrium')).toBe('Atrium');
    expect(locationText('Riverside Hub')).toBe('Riverside Hub');
    expect(memberText('Ada Lovelace')).toBe('Ada Lovelace');
  });
});

describe('labels', () => {
  it('names a room with its location and seats, and a member with the email', () => {
    expect(
      roomLabel({
        id: 'r',
        locationId: 'l',
        locationName: 'Riverside Hub',
        name: 'Atrium',
        type: 'meeting_room',
        capacity: 8,
        hourlyRate: 1000,
        amenities: [],
        status: 'available',
      }),
    ).toBe('Atrium · Riverside Hub (8 seats)');
    expect(
      memberLabel({
        id: 'm',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '+380 44 000 00 00',
        company: null,
        plan: 'flex',
        status: 'active',
        joinedAt: '2026-01-01',
      }),
    ).toBe('Ada Lovelace · ada@example.com');
  });
});

describe('bookingCount', () => {
  it('counts in the singular for one and the plural for the rest', () => {
    expect(bookingCount(1)).toBe('1 booking');
    expect(bookingCount(2)).toBe('2 bookings');
    expect(bookingCount(0)).toBe('0 bookings');
  });
});

describe('BULK_DONE', () => {
  it('says what each action did', () => {
    expect(BULK_DONE).toEqual({ confirm: 'confirmed', cancel: 'cancelled' });
  });
});
