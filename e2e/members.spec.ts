import { expect, test } from './fixtures';
import { ConfirmDialog } from './pages/confirm-dialog';
import { DetailsPage } from './pages/details-page';
import { MembersPage } from './pages/members-page';
import { Notifications } from './pages/notifications';
import {
  createBooking,
  createLocation,
  createMember,
  createRoom,
  firstOf,
  uniqueName,
  type MemberRecord,
  type PageOf,
} from './support/data';
import { daysFromToday } from './support/dates';
import { query, withQuery, withoutQuery } from './support/url';

type MemberView = MemberRecord & { company: string | null; phone: string };

test.describe('list', () => {
  test('lists the members of the API with the pager saying how many', async ({ page, api }) => {
    const { total } = await api.get<PageOf<MemberRecord>>('/members', { limit: 1 });
    const members = new MembersPage(page);
    await members.goto();

    expect(await members.table.total()).toBe(total);
    await expect(members.table.rows).toHaveCount(20);
  });

  test('finds a member by email', async ({ page, api }) => {
    const member = await firstOf<MemberRecord>(api, '/members');
    const members = new MembersPage(page);
    await members.goto();

    await members.toolbar.search.fill(member.email);
    await expect(page).toHaveURL(withQuery({ q: member.email }));
    await expect(members.table.rows).toHaveCount(1);
    await expect(members.table.row(member.email)).toBeVisible();
  });

  test('filters by plan and by status', async ({ page, api }) => {
    const { total } = await api.get<PageOf<MemberRecord>>('/members', {
      plan: 'dedicated',
      status: 'active',
      limit: 1,
    });
    const members = new MembersPage(page);
    await members.goto();

    await members.toolbar.choose('Plan', 'Dedicated');
    await members.toolbar.choose('Status', 'Active');
    await expect(page).toHaveURL(withQuery({ plan: 'dedicated', status: 'active' }));
    await expect.poll(() => members.table.total()).toBe(total);

    await members.toolbar.clearFilters.click();
    await expect(page).toHaveURL(withoutQuery);
  });

  test('says so when nothing matches', async ({ page }) => {
    const members = new MembersPage(page);
    await members.goto(query({ q: 'nobody by this name' }));
    await members.table.expectEmpty('No members match the current filters.');
  });

  test('goes to the next page, and a new search starts from the first one', async ({ page }) => {
    const members = new MembersPage(page);
    await members.goto();

    await members.table.nextPage.click();
    await expect(page).toHaveURL(withQuery({ page: '2' }));
    await expect(members.table.range).toHaveText(/^21–40 of \d+$/);

    await members.toolbar.search.fill('a');
    await expect(page).toHaveURL(withQuery({ q: 'a' }));
    await expect(members.table.pageLabel).toHaveText(/^Page 1 of \d+$/);
  });
});

test.describe('details', () => {
  test('shows the fields of a member, reached from the list', async ({ page, api }) => {
    const member = await firstOf<MemberView>(api, '/members');
    const members = new MembersPage(page);
    await members.goto(query({ q: member.email }));

    await members.table.link(`${member.firstName} ${member.lastName}`).click();
    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(`${member.firstName} ${member.lastName}`);
    await expect(details.value('Email')).toHaveText(member.email);
    await expect(details.value('Phone')).toHaveText(member.phone);
  });
});

test.describe('editing', { tag: '@mutating' }, () => {
  test('adds a member and opens their page', async ({ page }) => {
    const last = uniqueName('Testova').replace(' ', '');
    const members = new MembersPage(page);
    await members.goto();

    const form = await members.openNewMemberForm();
    await form.fillPerson('Dana', last, `dana.${last.toLowerCase()}@example.com`);
    await form.fill('Company', 'Test Works');
    await form.choose('Plan', 'Dedicated');
    await form.submitAndClose();

    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(`Dana ${last}`);
    await expect(details.value('Plan')).toHaveText('Dedicated');
    await expect(details.value('Company')).toHaveText('Test Works');
    await expect(new Notifications(page).toast('Member added')).toBeVisible();
  });

  test('explains what is wrong before saving', async ({ page }) => {
    const members = new MembersPage(page);
    await members.goto();
    const form = await members.openNewMemberForm();

    await form.save.click();
    await form.expectFieldError('First name', 'Required');
    await form.expectFieldError('Email', 'Enter a valid email');
    await form.expectFieldError('Phone', 'Enter a valid phone number');
    await expect(form.dialog).toBeVisible();
  });

  test('shows a duplicate email under its field and keeps the dialog open', async ({
    page,
    api,
  }) => {
    const existing = await createMember(api);
    const members = new MembersPage(page);
    await members.goto();

    const form = await members.openNewMemberForm();
    await form.fillPerson('Eve', 'Duplicate', existing.email);
    await form.save.click();

    await form.expectFieldError('Email', 'This email is already registered');
    await expect(form.dialog).toBeVisible();
    await expect(new Notifications(page).toast(/added/)).toHaveCount(0);

    await form.fill('Email', `eve.${existing.email}`);
    await form.submitAndClose();
  });

  test('edits a member from the list', async ({ page, api }) => {
    const member = await createMember(api);
    const fullName = `${member.firstName} ${member.lastName}`;
    const members = new MembersPage(page);
    await members.goto(query({ q: member.email }));

    const form = await members.openEditForm(fullName);
    await expect(form.field('Email')).toHaveValue(member.email);
    await form.fill('Company', 'Renamed Co');
    await form.choose('Status', 'Suspended');
    await form.submitAndClose();

    const row = members.table.row(member.email);
    await expect(row).toContainText('Renamed Co');
    await expect(row).toContainText('Suspended');
    await expect(new Notifications(page).toast('Member updated')).toBeVisible();
  });

  test('removes a member from their page', async ({ page, api }) => {
    const member = await createMember(api);
    const fullName = `${member.firstName} ${member.lastName}`;
    await page.goto(`/members/${member.id}`);
    const details = new DetailsPage(page);
    await expect(details.heading).toHaveText(fullName);

    await details.delete.click();
    const question = new ConfirmDialog(page, `Delete ${fullName}?`);
    await question.expectOpen();
    await question.confirm('Delete');

    await expect(page).toHaveURL(/\/members$/);
    await expect(new Notifications(page).toast('Member removed')).toBeVisible();
    const { items } = await api.get<PageOf<MemberRecord>>('/members', { q: member.email });
    expect(items).toHaveLength(0);
  });

  test('refuses to remove a member who has upcoming bookings', async ({ page, api }) => {
    const member = await createMember(api);
    const location = await createLocation(api);
    const room = await createRoom(api, location.id);
    await createBooking(api, { roomId: room.id, memberId: member.id, day: daysFromToday(8) });
    const fullName = `${member.firstName} ${member.lastName}`;
    const members = new MembersPage(page);
    await members.goto(query({ q: member.email }));

    await members.deleteButton(fullName).click();
    const question = new ConfirmDialog(page, `Delete ${fullName}?`);
    await question.expectOpen();
    await question.confirm('Delete');

    await expect(question.alert).toHaveText('This member has upcoming bookings; cancel them first');
    await question.cancel.click();
    await expect(members.table.row(member.email)).toBeVisible();
  });
});
