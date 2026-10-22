import { api } from '@/lib/api/client';
import { MAX_PAGE_SIZE } from '@/lib/contract/common';
import { locationPageSchema } from '@/lib/contract/location';

/** More pages than this are not read: a safeguard against a server that never stops growing. */
const MAX_LOCATION_PAGES = 20;

/**
 * Every location. The API sends at most 100 per page, so the pages are read until the total is
 * covered. Screens use it to look up the time zone of a location by id.
 */
export const fetchAllLocations = async (signal?: AbortSignal) => {
  const first = await api.get('locations', locationPageSchema, {
    query: { limit: MAX_PAGE_SIZE },
    signal,
  });
  const items = [...first.items];
  for (let page = 2; items.length < first.total && page <= MAX_LOCATION_PAGES; page += 1) {
    const next = await api.get('locations', locationPageSchema, {
      query: { limit: MAX_PAGE_SIZE, page },
      signal,
    });
    if (next.items.length === 0) break;
    items.push(...next.items);
  }
  return { ...first, items };
};
