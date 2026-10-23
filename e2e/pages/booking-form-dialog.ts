import { expect, type Locator, type Page } from '@playwright/test';

import { FormDialog } from './form-dialog';

/** The dialog that creates a booking (`New booking`) or edits one (`Edit booking`). */
export class BookingFormDialog extends FormDialog {
  /** The list of bookings that hold the room, when a save was refused for an overlap. */
  readonly conflicts: Locator;

  constructor(page: Page, title: string) {
    super(page, title);
    this.conflicts = this.dialog.getByRole('alert').filter({
      hasText: 'The room is already booked for this time.',
    });
  }

  /** The form appears once the time zones are known, and then takes focus to the room. */
  protected get initialFocus(): Locator {
    return this.field('Room');
  }

  /** Picks a day in the calendar of the date field, paging to its month first. */
  async chooseDate(isoDay: string): Promise<void> {
    const [year = '', , day = ''] = isoDay.split('-');
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
      new Date(`${isoDay}T12:00:00Z`),
    );
    const target = this.page.getByRole('button', {
      name: new RegExp(`^(Today, )?${Number(day)} ${monthName} ${year}(, selected)?$`),
    });
    await this.dateButton.click();
    // `isVisible` does not wait: the calendar must be drawn before it is asked about a day.
    await expect(this.page.getByRole('dialog', { name: 'Date calendar' })).toBeVisible();
    const next = this.page.getByRole('button', { name: 'Go to the Next Month' });
    for (let step = 0; step < 24 && !(await target.first().isVisible()); step += 1) {
      await next.click();
    }
    await target.first().click();
    await expect(target.first()).toBeHidden();
  }

  /** The date field's own button, named "Date, <day>" and, when it must be filled, ", required". */
  get dateButton(): Locator {
    return this.dialog.getByRole('button', { name: /^Date,/ });
  }

  async setTimes(from: string, to: string): Promise<void> {
    await this.fill('From', from);
    await this.fill('To', to);
  }
}
