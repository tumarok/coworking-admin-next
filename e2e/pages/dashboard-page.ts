import { expect, type Locator, type Page } from '@playwright/test';

/** `/`: the figures of one day. */
export class DashboardPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly date: Locator;
  readonly figures: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Dashboard', level: 1 });
    this.subtitle = page.getByText(/^Across all locations/);
    this.date = page.getByLabel('Date', { exact: true });
    this.figures = page.getByRole('group', { name: 'Dashboard figures' });
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/${query}`);
    await expect(this.heading).toBeVisible();
    await expect(this.figures).toBeVisible();
  }

  /** The figure under a label such as `Active members`. */
  kpi(label: string): Locator {
    return this.page
      .getByRole('region', { name: 'Key figures' })
      .locator('dl')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .getByRole('definition');
  }

  section(title: string): Locator {
    return this.page.getByRole('heading', { name: title, level: 2 });
  }

  /** The bookings coming up: one list item each, the time range of it a link to the booking. */
  get upcoming(): Locator {
    return this.section('Coming up')
      .locator('xpath=ancestor::*[@data-slot="card"][1]')
      .getByRole('listitem');
  }
}
