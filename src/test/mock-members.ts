import type { Member } from '@/lib/contract/member';
import { TEST_NOW, type installMockApi } from '@/test/mock-api';

type MockApi = ReturnType<typeof installMockApi>;

/** Statuses that keep a booking "upcoming" while it ends in the future (see the delete rule). */
const BUSY = new Set(['pending', 'confirmed', 'checked_in']);

/** Members in the order of the list: last name, then first name. */
export const membersByName = (api: MockApi): Member[] =>
  api.db.members.toSorted(
    (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
  );

/** True when the API would refuse to delete the member (409). */
export const hasUpcomingBookings = (api: MockApi, member: Member) =>
  api.db.bookings.some(
    (b) => b.memberId === member.id && BUSY.has(b.status) && Date.parse(b.endsAt) > TEST_NOW,
  );

/**
 * Members of the seeded data that the list tests need, found in the data instead of written
 * down: the first page of the list, members that can and cannot be deleted, one without a company.
 */
export const seededMembers = (api: MockApi, pageSize = 20) => {
  const all = membersByName(api);
  const page = all.slice(0, pageSize);
  const find = (label: string, member: Member | undefined) => {
    if (!member) throw new Error(`the seed has no member ${label}`);
    return member;
  };
  return {
    all,
    page,
    first: find('on the first page', page[0]),
    booked: find(
      'with upcoming bookings on the first page',
      page.find((m) => hasUpcomingBookings(api, m)),
    ),
    free: find(
      'without upcoming bookings on the first page',
      page.find((m) => !hasUpcomingBookings(api, m)),
    ),
    noCompany: find(
      'without a company on the first page',
      page.find((m) => m.company === null),
    ),
    withCompany: find(
      'with a company on the first page',
      page.find((m) => m.company !== null),
    ),
  };
};

/** `1–20 of 80`: what the table footer says for a result of `total` rows. */
export const rangeText = (total: number, pageSize = 20, page = 1) =>
  `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`;
