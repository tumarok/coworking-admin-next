import { expect, type Locator } from '@playwright/test';

import { FormDialog } from './form-dialog';

/** The dialog that creates a room (`New room`) or edits one (`Edit <name>`). */
export class RoomFormDialog extends FormDialog {
  protected get initialFocus(): Locator {
    return this.field('Location');
  }

  /** Ticks amenities in the multi-select and closes its list. */
  async chooseAmenities(...names: string[]): Promise<void> {
    const trigger = this.field('Amenities');
    await trigger.click();
    for (const name of names) await this.page.getByRole('option', { name, exact: true }).click();
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByRole('option', { name: names[0] })).toBeHidden();
  }
}
