import { expect, type Locator, type Page } from '@playwright/test';

import { BookingFormDialog } from './booking-form-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { DataTable } from './data-table';
import { ListToolbar } from './toolbar';

/** `/bookings`: the list, its filters and the bulk actions on the rows ticked. */
export class BookingsPage {
  readonly heading: Locator;
  readonly newBooking: Locator;
  readonly toolbar: ListToolbar;
  readonly table: DataTable;
  readonly fromDate: Locator;
  readonly toDate: Locator;
  /** "2 selected": a live region that says nothing while nothing is ticked. */
  readonly selectedCount: Locator;
  readonly bulkConfirm: Locator;
  readonly bulkCancel: Locator;
  readonly clearSelection: Locator;
  /** What a bulk action left alone, and why. */
  readonly refused: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Bookings', level: 1 });
    this.newBooking = page.getByRole('button', { name: 'New booking' });
    this.toolbar = new ListToolbar(page, 'Search member or room');
    this.table = new DataTable(page, 'Bookings');
    this.fromDate = page.getByLabel('From date');
    this.toDate = page.getByLabel('To date');
    this.selectedCount = page.getByRole('status').filter({ hasText: /\d+ selected/ });
    this.bulkConfirm = page.getByRole('button', { name: 'Confirm selected bookings' });
    this.bulkCancel = page.getByRole('button', { name: 'Cancel selected bookings' });
    this.clearSelection = page.getByRole('button', { name: 'Clear selection' });
    this.refused = page.getByRole('dialog', { name: /^Some bookings were not/ });
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/bookings${query}`);
    await expect(this.heading).toBeVisible();
    await this.table.expectLoaded();
  }

  async openNewBookingForm(): Promise<BookingFormDialog> {
    await this.newBooking.click();
    const dialog = new BookingFormDialog(this.page, 'New booking');
    await dialog.expectOpen();
    return dialog;
  }

  /** Asks to cancel what is ticked and returns the question. */
  async askToCancelSelected(count: number): Promise<ConfirmDialog> {
    await this.bulkCancel.click();
    const question = new ConfirmDialog(
      this.page,
      `Cancel ${count} ${count === 1 ? 'booking' : 'bookings'}?`,
    );
    await question.expectOpen();
    return question;
  }
}
