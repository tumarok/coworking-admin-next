import type { Locator } from '@playwright/test';

import { FormDialog } from './form-dialog';

/** The dialog that creates a location (`New location`) or edits one (`Edit <name>`). */
export class LocationFormDialog extends FormDialog {
  protected get initialFocus(): Locator {
    return this.field('Name');
  }
}
