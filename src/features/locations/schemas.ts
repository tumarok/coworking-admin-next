import { locationInputSchema, type Location, type LocationInput } from '@/lib/contract/location';

/** The form validates with the same schema as the API, so both agree on every rule and message. */
export const locationFormSchema = locationInputSchema;
export type LocationFormValues = LocationInput;

export const LOCATION_FORM_DEFAULTS: LocationFormValues = {
  name: '',
  city: '',
  address: '',
  timezone: 'Europe/Kyiv',
  opensAt: '08:00',
  closesAt: '20:00',
  status: 'active',
};

/** Field names a 422 can point at. */
export const LOCATION_FORM_FIELDS = Object.keys(LOCATION_FORM_DEFAULTS) as Array<
  keyof LocationFormValues
>;

/** Form values of a location being edited; defaults for a new one. */
export const toFormValues = (location?: Location): LocationFormValues =>
  location
    ? {
        name: location.name,
        city: location.city,
        address: location.address,
        timezone: location.timezone,
        opensAt: location.opensAt,
        closesAt: location.closesAt,
        status: location.status,
      }
    : LOCATION_FORM_DEFAULTS;
