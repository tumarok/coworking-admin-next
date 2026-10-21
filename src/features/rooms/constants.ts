import { humanize } from '@/lib/humanize';
import type { Location } from '@/lib/contract/location';
import { AMENITIES, ROOM_STATUSES, ROOM_TYPES } from '@/lib/contract/room';

const toOptions = (values: readonly string[]) =>
  values.map((value) => ({ value, label: humanize(value) }));

/** Room types, statuses and amenities as filter and form options. */
export const TYPE_OPTIONS = toOptions(ROOM_TYPES);
export const STATUS_OPTIONS = toOptions(ROOM_STATUSES);
export const AMENITY_OPTIONS = toOptions(AMENITIES);

/** Filter keys of the list, in the URL next to `page`, `limit` and `q`. */
export const FILTER_KEYS = ['locationId', 'type', 'status'] as const;

/**
 * What each filter accepts; other values in the URL count as no filter. The location is any id:
 * the API owns the list of locations, so an unknown one simply finds no rooms.
 */
export const FILTER_VALUES = { type: ROOM_TYPES, status: ROOM_STATUSES } as const;

/** How the location drop-downs (form and filter) name a location: the city tells namesakes apart. */
export const locationLabel = (location: Location) => `${location.name} (${location.city})`;
