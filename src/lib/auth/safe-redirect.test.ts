import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it.each(['/', '/bookings', '/bookings?status=pending&page=2', '/rooms/42', '/a#section'])(
    'accepts %s',
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    },
  );

  it.each([
    ['not a string', undefined],
    ['a number', 5],
    ['a list', ['/bookings']],
    ['empty', ''],
    ['relative', 'bookings'],
    ['another origin', 'https://evil.test/'],
    ['protocol-relative', '//evil.test'],
    ['protocol-relative with a path', '//evil.test/bookings'],
    ['a backslash host', '/\\evil.test'],
    ['a backslash anywhere', '/bookings\\..\\x'],
    ['a tab that the parser would drop', '/\t/evil.test'],
    ['a newline', '/bookings\n'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['the login page', '/login'],
    ['the login page with a query', '/login?from=/bookings'],
    ['below the login page', '/login/x'],
  ])('rejects %s', (_name, value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });

  it('does not mistake a longer name for the login page', () => {
    expect(safeRedirectPath('/login-help')).toBe('/login-help');
  });
});
