import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@/config/session';
import {
  clearSessionCookie,
  readSessionToken,
  sessionCookieOptions,
  setSessionCookie,
} from './session-cookie';

const jar = () => new NextResponse().cookies;

describe('session cookie', () => {
  it('is httpOnly, lax and site-wide, without an expiry', () => {
    const cookies = jar();

    setSessionCookie(cookies, 'token-1');

    expect(cookies.get(SESSION_COOKIE)).toMatchObject({
      value: 'token-1',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    });
    expect(cookies.get(SESSION_COOKIE)?.expires).toBeUndefined();
    expect(cookies.get(SESSION_COOKIE)?.maxAge).toBeUndefined();
  });

  it('is cleared with the attributes it was set with', () => {
    const cookies = jar();

    clearSessionCookie(cookies);

    expect(cookies.get(SESSION_COOKIE)).toMatchObject({
      value: '',
      maxAge: 0,
      ...sessionCookieOptions(),
    });
  });

  it('reads the token, treating an empty value as no session', () => {
    const cookies = jar();
    expect(readSessionToken(cookies)).toBeUndefined();

    cookies.set(SESSION_COOKIE, '');
    expect(readSessionToken(cookies)).toBeUndefined();

    cookies.set(SESSION_COOKIE, 'token-1');
    expect(readSessionToken(cookies)).toBe('token-1');
  });
});
