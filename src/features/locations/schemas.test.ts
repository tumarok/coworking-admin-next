import { describe, expect, it } from 'vitest';
import type { Location } from '@/lib/contract/location';
import {
  LOCATION_FORM_DEFAULTS,
  LOCATION_FORM_FIELDS,
  locationFormSchema,
  toFormValues,
} from './schemas';

const LOCATION: Location = {
  id: 'loc_1',
  name: 'Riverside Hub',
  city: 'Kyiv',
  address: '12 Naberezhna St',
  timezone: 'Europe/Kyiv',
  opensAt: '08:00',
  closesAt: '21:00',
  status: 'active',
  roomCount: 6,
};

describe('toFormValues', () => {
  it('uses the defaults for a new location', () => {
    expect(toFormValues()).toEqual(LOCATION_FORM_DEFAULTS);
  });

  it('takes the editable fields of an existing one and leaves the server fields out', () => {
    expect(toFormValues(LOCATION)).toEqual({
      name: 'Riverside Hub',
      city: 'Kyiv',
      address: '12 Naberezhna St',
      timezone: 'Europe/Kyiv',
      opensAt: '08:00',
      closesAt: '21:00',
      status: 'active',
    });
  });

  it('produces values the form schema accepts', () => {
    expect(locationFormSchema.safeParse(toFormValues(LOCATION)).success).toBe(true);
  });
});

describe('locationFormSchema', () => {
  const valid = toFormValues(LOCATION);

  it('trims and checks the text fields', () => {
    const result = locationFormSchema.safeParse({ ...valid, name: ' A ', city: '', address: 'x' });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['name', 'At least 2 characters'],
      ['city', 'At least 2 characters'],
      ['address', 'At least 5 characters'],
    ]);
  });

  it('wants the location to close after it opens, reported on the closing time', () => {
    const result = locationFormSchema.safeParse({ ...valid, opensAt: '10:00', closesAt: '10:00' });

    expect(result.error?.issues).toMatchObject([
      { path: ['closesAt'], message: 'Closing time must be after opening time' },
    ]);
  });
});

describe('LOCATION_FORM_FIELDS', () => {
  it('lists every field of the form', () => {
    expect(LOCATION_FORM_FIELDS.toSorted()).toEqual(
      ['address', 'city', 'closesAt', 'name', 'opensAt', 'status', 'timezone'].toSorted(),
    );
  });
});
