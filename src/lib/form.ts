import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api/errors';

const UNEXPECTED = 'Something went wrong. Try again.';

/**
 * Puts the field messages of a 422 under their fields (the first one takes focus) and returns
 * what is left for the form-level alert: the message of the API when some field is unknown to the
 * form or the error has none, `null` when every message found its field.
 */
export const applyServerErrors = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  aliases: Readonly<Record<string, Path<T>>> = {},
): string | null => {
  if (!(error instanceof ApiError)) return UNEXPECTED;
  const entries = Object.entries(error.fieldErrors ?? {}).map(
    ([field, message]) => [aliases[field] ?? field, message] as const,
  );
  const known = entries.filter(([field]) => (fields as readonly string[]).includes(field));
  known.forEach(([field, message], index) => {
    setError(field as Path<T>, { type: 'server', message }, { shouldFocus: index === 0 });
  });
  return known.length > 0 && known.length === entries.length ? null : error.message;
};
