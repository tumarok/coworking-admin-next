import { describe, expect, it } from 'vitest';
import { centsToEuros, eurosToCents, formatMoney, isWholeCents } from './money';

describe('formatMoney', () => {
  it('prints cents as euros with two decimals', () => {
    expect(formatMoney(1250)).toBe('€12.50');
    expect(formatMoney(0)).toBe('€0.00');
    expect(formatMoney(2500)).toBe('€25.00');
  });

  it('separates thousands', () => {
    expect(formatMoney(1_234_567)).toBe('€12,345.67');
  });
});

describe('centsToEuros', () => {
  it('divides by one hundred', () => {
    expect(centsToEuros(3250)).toBe(32.5);
    expect(centsToEuros(5)).toBe(0.05);
  });
});

describe('eurosToCents', () => {
  it('turns euros into whole cents', () => {
    expect(eurosToCents(32.5)).toBe(3250);
    expect(eurosToCents(0)).toBe(0);
  });

  it('absorbs float noise of amounts that are whole cents', () => {
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
    expect(eurosToCents(19.99)).toBe(1999);
    expect(eurosToCents(4.35)).toBe(435);
  });

  it('round-trips every price in cents', () => {
    for (const cents of [0, 1, 99, 100, 1999, 1_000_000]) {
      expect(eurosToCents(centsToEuros(cents))).toBe(cents);
    }
  });
});

describe('isWholeCents', () => {
  it.each([0, 1, 25, 32.5, 19.99, 0.01, 4.35, 0.1 + 0.2, 10_000])('accepts %s', (euros) => {
    expect(isWholeCents(euros)).toBe(true);
  });

  it.each([19.999, 1.005, 12.345, 0.001, 0.015])('refuses %s: part of a cent', (euros) => {
    expect(isWholeCents(euros)).toBe(false);
  });

  it('does not accept a number that is not one', () => {
    expect(isWholeCents(Number.NaN)).toBe(false);
  });
});
