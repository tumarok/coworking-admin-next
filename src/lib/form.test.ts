import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { applyServerErrors } from './form';

const FIELDS = ['name', 'city'] as const;

describe('applyServerErrors', () => {
  it('sets each known field message and focuses only the first', () => {
    const setError = vi.fn();
    const error = new ApiError(422, {
      message: 'Validation failed',
      fieldErrors: { name: 'Taken', city: 'Unknown city' },
    });

    expect(applyServerErrors(error, setError, FIELDS)).toBeNull();

    expect(setError).toHaveBeenNthCalledWith(
      1,
      'name',
      { type: 'server', message: 'Taken' },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      'city',
      { type: 'server', message: 'Unknown city' },
      { shouldFocus: false },
    );
  });

  it('returns the API message when a field is not part of the form', () => {
    const setError = vi.fn();
    const error = new ApiError(422, {
      message: 'Validation failed',
      fieldErrors: { name: 'Taken', color: 'Nope' },
    });

    expect(applyServerErrors(error, setError, FIELDS)).toBe('Validation failed');
    expect(setError).toHaveBeenCalledTimes(1);
  });

  it('returns the API message when there are no field errors', () => {
    const setError = vi.fn();

    expect(applyServerErrors(new ApiError(409, { message: 'Conflict' }), setError, FIELDS)).toBe(
      'Conflict',
    );
    expect(setError).not.toHaveBeenCalled();
  });

  it('gives a generic message for anything that is not an API error', () => {
    expect(applyServerErrors(new TypeError('x'), vi.fn(), FIELDS)).toBe(
      'Something went wrong. Try again.',
    );
  });
});
