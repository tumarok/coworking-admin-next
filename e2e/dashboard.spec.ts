import { expect, test } from './fixtures';
import { DashboardPage } from './pages/dashboard-page';
import { DetailsPage } from './pages/details-page';
import { daysFromToday, printedDay } from './support/dates';
import type { LocationRecord, PageOf } from './support/data';

test('shows the figures of the day', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  for (const label of ['Bookings', 'Occupancy', 'Revenue this month', 'Active members']) {
    await expect(dashboard.kpi(label)).toBeVisible();
  }
  for (const title of ['Occupancy by location', 'Bookings by status', 'Coming up']) {
    await expect(dashboard.section(title)).toBeVisible();
  }
  await expect(dashboard.subtitle).toHaveText(/^Across all locations on \d{1,2} \w{3} \d{4}$/);
});

test('counts the active members the API has', async ({ page, api }) => {
  const { total } = await api.get<PageOf<unknown>>('/members', { status: 'active', limit: 1 });
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await expect(dashboard.kpi('Active members')).toHaveText(String(total));
});

test('draws an occupancy bar for every active location', async ({ page, api }) => {
  const { items } = await api.get<PageOf<LocationRecord & { status: string }>>('/locations', {
    status: 'active',
    limit: 100,
  });
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  for (const location of items) {
    await expect(
      page.getByRole('progressbar', { name: `${location.name} occupancy` }),
    ).toBeVisible();
  }
});

test('shows another day from the URL and keeps it there', async ({ page }) => {
  const day = daysFromToday(3);
  const dashboard = new DashboardPage(page);
  await dashboard.goto(`?date=${day}`);

  await expect(dashboard.subtitle).toHaveText(`Across all locations on ${printedDay(day)}`);
  await expect(dashboard.date).toHaveValue(day);
  await expect(page).toHaveURL(new RegExp(`\\?date=${day}$`));
});

test('writes the day typed in the date field to the URL', async ({ page }) => {
  const day = daysFromToday(-5);
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await dashboard.date.fill(day);
  await expect(page).toHaveURL(new RegExp(`\\?date=${day}$`));
  await expect(dashboard.subtitle).toHaveText(`Across all locations on ${printedDay(day)}`);
});

test('takes a date it cannot read for today', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto('?date=not-a-day');

  await expect(dashboard.subtitle).toHaveText(
    `Across all locations on ${printedDay(daysFromToday(0))}`,
  );
  await expect(dashboard.kpi('Active members')).toBeVisible();
});

test('opens a booking from the ones coming up', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await dashboard.upcoming.first().getByRole('link').click();

  await expect(page).toHaveURL(/\/bookings\/\w+$/);
  await expect(new DetailsPage(page).value('Status')).toBeVisible();
});
