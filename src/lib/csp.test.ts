import { describe, expect, it } from 'vitest';
import { buildCsp, createNonce } from './csp';

const directive = (csp: string, name: string) =>
  csp.split('; ').find((part) => part.startsWith(`${name} `));

describe('createNonce', () => {
  it('is different every time', () => {
    expect(createNonce()).not.toBe(createNonce());
  });

  it('is base64, safe inside a header', () => {
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe('buildCsp', () => {
  it('authorises scripts by nonce and nothing inline', () => {
    const script = directive(buildCsp('abc', false), 'script-src');

    expect(script).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
  });

  it('allows eval in development only', () => {
    expect(directive(buildCsp('abc', true), 'script-src')).toContain("'unsafe-eval'");
    expect(buildCsp('abc', false)).not.toContain('unsafe-eval');
  });

  it('keeps the page from being framed or posting elsewhere', () => {
    const csp = buildCsp('abc', false);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});
