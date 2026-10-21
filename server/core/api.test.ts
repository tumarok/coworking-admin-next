import { beforeEach, describe, expect, it } from 'vitest';

import type { LoginResponse } from '../../src/lib/contract/auth.ts';
import { type Booking, MAX_BULK_BOOKINGS } from '../../src/lib/contract/booking.ts';
import type { Page } from '../../src/lib/contract/common.ts';
import { dashboardSchema } from '../../src/lib/contract/dashboard.ts';
import { type Member, type MemberInput, memberPageSchema } from '../../src/lib/contract/member.ts';
import { type Room, type RoomInput, roomPageSchema } from '../../src/lib/contract/room.ts';

import { type MockApi, createApi } from './api.ts';
import { DEMO_PASSWORD } from './db.ts';

const NOW = Date.parse('2026-10-14T09:00:00.000Z');

let api: MockApi;
let auth: string;

const call = (method: string, path: string, body?: unknown, query: Record<string, string> = {}) =>
  api.handle({ method, path, query, body, authorization: auth });

beforeEach(() => {
  api = createApi({ now: NOW, clock: () => NOW });
  const login = api.handle({
    method: 'POST',
    path: '/auth/login',
    query: {},
    body: { email: 'admin@coworking.test', password: DEMO_PASSWORD },
  });
  auth = `Bearer ${(login.body as LoginResponse).token}`;
});

describe('mock API', () => {
  it('rejects a wrong password with 401 and requires a token elsewhere', () => {
    const login = api.handle({
      method: 'POST',
      path: '/auth/login',
      query: {},
      body: { email: 'admin@coworking.test', password: 'nope' },
    });
    expect(login.status).toBe(401);
    expect(api.handle({ method: 'GET', path: '/locations', query: {} }).status).toBe(401);
  });

  it('paginates and filters lists', () => {
    const first = call('GET', '/members', undefined, { page: '1', limit: '10' });
    const page = first.body as Page<unknown>;
    expect(first.status).toBe(200);
    expect(page.items).toHaveLength(10);
    expect(page.total).toBeGreaterThan(10);

    const active = call('GET', '/members', undefined, { status: 'active', limit: '100' });
    const items = (active.body as Page<{ status: string }>).items;
    expect(items.every((m) => m.status === 'active')).toBe(true);
  });

  it('returns field errors for an invalid payload', () => {
    const res = call('POST', '/locations', { name: 'X' });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ fieldErrors: { name: 'At least 2 characters' } });
  });

  it('refuses to delete a location that still has rooms', () => {
    const location = api.db.locations[0];
    expect(call('DELETE', `/locations/${location?.id}`).status).toBe(409);
  });

  describe('rooms', () => {
    const roomInput: RoomInput = {
      locationId: 'loc_1',
      name: 'Garden Annex',
      type: 'meeting_room',
      capacity: 8,
      hourlyRate: 3250,
      amenities: ['projector', 'whiteboard'],
      status: 'available',
    };
    const rooms = (query: Record<string, string> = {}) =>
      roomPageSchema.parse(call('GET', '/rooms', undefined, { limit: '100', ...query }).body);

    it('lists rooms by location and name, and filters by location, type and search', () => {
      const all = rooms().items;
      const sorted = all.toSorted(
        (a, b) => a.locationName.localeCompare(b.locationName) || a.name.localeCompare(b.name),
      );
      expect(all).toEqual(sorted);

      const here = rooms({ locationId: 'loc_1' }).items;
      expect(here.length).toBeGreaterThan(0);
      expect(here.every((r) => r.locationId === 'loc_1')).toBe(true);
      expect(rooms({ type: 'hot_desk' }).items.every((r) => r.type === 'hot_desk')).toBe(true);

      const first = all[0] as Room;
      expect(rooms({ q: first.name.toUpperCase() }).items).toContainEqual(first);
      expect(call('GET', '/rooms', undefined, { type: 'bogus' }).status).toBe(422);
    });

    it('creates, updates and reads a room, pricing in cents', () => {
      const created = call('POST', '/rooms', roomInput);
      expect(created.status).toBe(201);
      const room = created.body as Room;
      expect(room).toMatchObject({ ...roomInput, locationName: 'Riverside Hub' });

      const updated = call('PATCH', `/rooms/${room.id}`, { ...roomInput, hourlyRate: 4000 });
      expect(updated.body).toMatchObject({ id: room.id, hourlyRate: 4000 });
      expect(call('GET', `/rooms/${room.id}`).body).toMatchObject({ hourlyRate: 4000 });
    });

    it('refuses a room in an unknown location and a negative rate', () => {
      const unknown = call('POST', '/rooms', { ...roomInput, locationId: 'loc_nope' });
      expect(unknown.status).toBe(422);
      expect(unknown.body).toMatchObject({ fieldErrors: { locationId: 'Location not found' } });

      const negative = call('POST', '/rooms', { ...roomInput, hourlyRate: -1 });
      expect(negative.body).toMatchObject({ fieldErrors: { hourlyRate: 'Cannot be negative' } });
    });

    it('deletes a room nobody booked and answers 404 afterwards', () => {
      const room = call('POST', '/rooms', roomInput).body as Room;

      expect(call('DELETE', `/rooms/${room.id}`).status).toBe(204);
      expect(call('GET', `/rooms/${room.id}`).status).toBe(404);
    });

    it('prints a booking of a deleted room with a dash for its names and no location', () => {
      const template = api.db.bookings.find((b) => Date.parse(b.endsAt) <= NOW);
      if (!template) throw new Error('seed lacks a past booking');
      // A room whose only booking is over can be deleted; the booking stays.
      const room = call('POST', '/rooms', roomInput).body as Room;
      const past = { ...template, id: 'bk_past', roomId: room.id, status: 'completed' as const };
      api.db.bookings.push(past);

      expect(call('DELETE', `/rooms/${room.id}`).status).toBe(204);
      const res = call('GET', `/bookings/${past.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: past.id,
        roomName: '—',
        locationId: '',
        locationName: '—',
      });
    });

    it('refuses to delete a room with upcoming bookings', () => {
      const booking = api.db.bookings.find(
        (b) => Date.parse(b.endsAt) > NOW && ['pending', 'confirmed'].includes(b.status),
      );
      if (!booking) throw new Error('seed lacks an upcoming booking');

      const res = call('DELETE', `/rooms/${booking.roomId}`);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        message: 'This room has upcoming bookings; cancel them first',
      });
    });
  });

  describe('members', () => {
    const memberInput: MemberInput = {
      firstName: 'Dana',
      lastName: 'Testova',
      email: 'dana.testova@example.com',
      phone: '+380 44 000 00 00',
      company: 'Test Studio',
      plan: 'team',
      status: 'active',
    };
    const members = (query: Record<string, string> = {}) =>
      memberPageSchema.parse(call('GET', '/members', undefined, { limit: '100', ...query }).body);

    it('lists members by last and first name and filters by plan, status and search', () => {
      const all = members().items;
      const sorted = all.toSorted(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      );
      expect(all).toEqual(sorted);

      expect(members({ plan: 'team' }).items.every((m) => m.plan === 'team')).toBe(true);
      expect(members({ status: 'suspended' }).items.every((m) => m.status === 'suspended')).toBe(
        true,
      );
      const first = all[0] as Member;
      expect(
        members({ q: `${first.firstName} ${first.lastName}`.toUpperCase() }).items,
      ).toContainEqual(first);
      expect(members({ q: first.email.toUpperCase() }).items).toContainEqual(first);
      expect(call('GET', '/members', undefined, { plan: 'gold' }).status).toBe(422);
    });

    it('creates a member with today as the join date, a lower-case email and no empty company', () => {
      const created = call('POST', '/members', {
        ...memberInput,
        email: 'Dana.Testova@Example.com',
        company: '',
      });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        ...memberInput,
        email: 'dana.testova@example.com',
        company: null,
        joinedAt: '2026-10-14',
      });
    });

    it('answers 422 under the email field for an address that is already registered', () => {
      const taken = (api.db.members[0] as Member).email;

      const res = call('POST', '/members', { ...memberInput, email: taken.toUpperCase() });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        fieldErrors: { email: 'This email is already registered' },
      });
    });

    it('lets a member keep their own email on update but not take another one', () => {
      const [mine, other] = api.db.members as [Member, Member];
      const input = { ...memberInput, email: mine.email };

      const same = call('PATCH', `/members/${mine.id}`, { ...input, firstName: 'Renamed' });
      expect(same.status).toBe(200);
      expect(same.body).toMatchObject({
        id: mine.id,
        firstName: 'Renamed',
        joinedAt: mine.joinedAt,
      });

      const taken = call('PATCH', `/members/${mine.id}`, { ...input, email: other.email });
      expect(taken.status).toBe(422);
      expect(taken.body).toMatchObject({
        fieldErrors: { email: 'This email is already registered' },
      });
      expect(call('PATCH', '/members/mem_nope', memberInput).status).toBe(404);
    });

    it('deletes a member without upcoming bookings and answers 404 afterwards', () => {
      const member = call('POST', '/members', memberInput).body as Member;

      expect(call('DELETE', `/members/${member.id}`).status).toBe(204);
      expect(call('GET', `/members/${member.id}`).status).toBe(404);
    });

    it('refuses to delete a member with upcoming bookings', () => {
      const booking = api.db.bookings.find(
        (b) => Date.parse(b.endsAt) > NOW && ['pending', 'confirmed'].includes(b.status),
      );
      if (!booking) throw new Error('seed lacks an upcoming booking');

      const res = call('DELETE', `/members/${booking.memberId}`);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        message: 'This member has upcoming bookings; cancel them first',
      });
    });
  });

  it('confirms what it can in bulk and explains the rest', () => {
    const firstWith = (status: string) =>
      (call('GET', '/bookings', undefined, { status }).body as Page<Booking>).items[0];
    const pending = firstWith('pending');
    const completed = firstWith('completed');
    if (!pending || !completed) throw new Error('seed lacks pending or completed bookings');

    const res = call('POST', '/bookings/bulk', {
      ids: [pending.id, completed.id],
      action: 'confirm',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      updated: [pending.id],
      failed: [{ id: completed.id, reason: 'Cannot confirm a booking that is completed' }],
    });
  });

  describe('bulk bookings', () => {
    const idsWith = (status: string, count: number) =>
      (call('GET', '/bookings', undefined, { status, limit: '50' }).body as Page<Booking>).items
        .slice(0, count)
        .map((booking) => booking.id);

    it('cancels what can be cancelled and moves it to cancelled', () => {
      const [pending, confirmed] = [idsWith('pending', 1)[0], idsWith('confirmed', 1)[0]];
      if (!pending || !confirmed) throw new Error('seed lacks pending or confirmed bookings');

      const res = call('POST', '/bookings/bulk', { ids: [pending, confirmed], action: 'cancel' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ updated: [pending, confirmed], failed: [] });
      for (const id of [pending, confirmed]) {
        expect((call('GET', `/bookings/${id}`).body as Booking).status).toBe('cancelled');
      }
    });

    it('answers "Booking not found" for an id it does not have, in the order asked', () => {
      const pending = idsWith('pending', 1)[0];
      if (!pending) throw new Error('seed lacks a pending booking');

      const res = call('POST', '/bookings/bulk', {
        ids: ['bk_missing', pending],
        action: 'confirm',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        updated: [pending],
        failed: [{ id: 'bk_missing', reason: 'Booking not found' }],
      });
    });

    it('does not merge a repeated id: the second time it is refused', () => {
      const pending = idsWith('pending', 1)[0];
      if (!pending) throw new Error('seed lacks a pending booking');

      const res = call('POST', '/bookings/bulk', { ids: [pending, pending], action: 'confirm' });

      expect(res.body).toEqual({
        updated: [pending],
        failed: [{ id: pending, reason: 'Cannot confirm a booking that is confirmed' }],
      });
    });

    it('refuses an empty list of ids with a 422 on `ids`', () => {
      const res = call('POST', '/bookings/bulk', { ids: [], action: 'confirm' });

      expect(res.status).toBe(422);
      expect(Object.keys((res.body as { fieldErrors: object }).fieldErrors)).toEqual(['ids']);
    });

    it('refuses more than the most one request takes with a 422 on `ids`', () => {
      const ids = Array.from({ length: MAX_BULK_BOOKINGS + 1 }, (_, i) => `bk_${i}`);

      const res = call('POST', '/bookings/bulk', { ids, action: 'cancel' });

      expect(res.status).toBe(422);
      expect(Object.keys((res.body as { fieldErrors: object }).fieldErrors)).toEqual(['ids']);
    });
  });

  it('enforces status transitions', () => {
    const bookings = (
      call('GET', '/bookings', undefined, { status: 'completed' }).body as Page<Booking>
    ).items;
    const res = call('POST', `/bookings/${bookings[0]?.id}/status`, { status: 'pending' });
    expect(res.status).toBe(409);
  });

  it('builds a dashboard for a given day', () => {
    const res = call('GET', '/dashboard', undefined, { date: '2026-10-14' });
    expect(res.status).toBe(200);
    expect(dashboardSchema.parse(res.body).date).toBe('2026-10-14');
  });
});
