import type { Locator, Page } from '@playwright/test';

import { ConfirmDialog } from './confirm-dialog';
import { DetailsPage } from './details-page';

/** `/bookings/<id>`: the fields of a booking and the moves it can make. */
export class BookingDetailsPage extends DetailsPage {
  readonly cancelBooking: Locator;

  constructor(page: Page) {
    super(page);
    this.cancelBooking = page.getByRole('button', { name: 'Cancel booking', exact: true });
  }

  /** A button of a status change: `Confirm`, `Check in`, `Complete`, `No-show`. */
  move(label: string): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  async askToCancel(): Promise<ConfirmDialog> {
    await this.cancelBooking.click();
    const question = new ConfirmDialog(this.page, 'Cancel this booking?');
    await question.expectOpen();
    return question;
  }
}
