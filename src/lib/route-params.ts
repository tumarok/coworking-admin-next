/** Ids the API hands out (`loc_1`, `room_12`). Anything else cannot name a record. */
const ENTITY_ID = /^[\w-]{1,64}$/;

/** Guards a `[id]` segment before it becomes a request: a malformed id is a 404, not an API call. */
export const isEntityId = (value: string) => ENTITY_ID.test(value);
