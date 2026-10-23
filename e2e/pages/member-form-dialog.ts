import type { Locator } from '@playwright/test';

import { FormDialog } from './form-dialog';

/** The dialog that adds a member (`New member`) or edits one (`Edit <name>`). */
export class MemberFormDialog extends FormDialog {
  protected get initialFocus(): Locator {
    return this.field('First name');
  }

  async fillPerson(first: string, last: string, email: string, phone = '+380 44 000 00 00') {
    await this.fill('First name', first);
    await this.fill('Last name', last);
    await this.fill('Email', email);
    await this.fill('Phone', phone);
  }
}
