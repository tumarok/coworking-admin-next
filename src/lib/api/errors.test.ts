import { describe, expect, it } from 'vitest';
import { ApiError, parseApiError } from './errors';

const json = (body: unknown, status: number) => Response.json(body, { status });

describe('parseApiError', () => {
  it('reads the message', async () => {
    const error = await parseApiError(json({ message: 'Room not found' }, 404));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Room not found' });
    expect(error.fieldErrors).toBeUndefined();
    expect(error.conflicts).toBeUndefined();
  });

  it('keeps the field errors of a 422', async () => {
    const error = await parseApiError(
      json({ message: 'Invalid data', fieldErrors: { email: 'Already taken' } }, 422),
    );

    expect(error.fieldErrors).toEqual({ email: 'Already taken' });
  });

  it('keeps the conflicts of a 409', async () => {
    const conflicts = [
      { id: 'b1', startsAt: '2026-10-14T09:00:00.000Z', endsAt: '2026-10-14T10:00:00.000Z' },
    ];

    const error = await parseApiError(json({ message: 'Room is taken', conflicts }, 409));

    expect(error.conflicts).toEqual(conflicts);
  });

  it.each([
    ['400', new Response('<html>Bad</html>', { status: 400 }), 'The request failed'],
    ['500', new Response('', { status: 500 }), 'The server failed to handle the request'],
    [
      'a body of the wrong shape',
      json({ error: 'x' }, 502),
      'The server failed to handle the request',
    ],
  ])('falls back to a fixed message for %s', async (_name, response, message) => {
    const error = await parseApiError(response);

    expect(error.message).toBe(message);
    expect(error.status).toBe(response.status);
  });
});
