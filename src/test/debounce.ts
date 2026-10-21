import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS } from '@/components/search-input';

/**
 * Fakes the clock for a test of a debounced search box and returns a `user` that keeps it moving.
 * The clock still follows real time (`shouldAdvanceTime`), so network mocks and `findBy*` keep
 * working; `pause()` jumps over the debounce instead of waiting for it. Call it before rendering;
 * the clock is real again after each test (`vitest.setup.dom.ts`).
 */
export const useFakeDebounce = () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  /** Lets the typing pause: the search box sends its text up. */
  const pause = () => {
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
  };
  return { user, pause };
};
