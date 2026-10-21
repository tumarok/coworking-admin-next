import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './search-input';

const LABEL = 'Search rooms';

describe('SearchInput', () => {
  it('is a search box named by its label and starts with the value of the owner', () => {
    render(<SearchInput label={LABEL} value="hub" onSearch={vi.fn()} />);

    expect(screen.getByRole('searchbox', { name: LABEL })).toHaveValue('hub');
  });

  it('sends the text up once, after typing pauses', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput label={LABEL} value="" onSearch={onSearch} />);

    await user.type(screen.getByRole('searchbox'), 'kyiv');
    expect(onSearch).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('kyiv');
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('keeps what is typed while the owner echoes an older value back', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SearchInput label={LABEL} value="" onSearch={onSearch} />);

    await user.type(screen.getByRole('searchbox'), 'ab');
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('ab');
    });
    await user.type(screen.getByRole('searchbox'), 'c');
    rerender(<SearchInput label={LABEL} value="ab" onSearch={onSearch} />);

    expect(screen.getByRole('searchbox')).toHaveValue('abc');
  });

  it('follows a change of the value that did not come from typing', () => {
    const { rerender } = render(<SearchInput label={LABEL} value="hub" onSearch={vi.fn()} />);

    rerender(<SearchInput label={LABEL} value="" onSearch={vi.fn()} />);

    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('does not send the text it was given', () => {
    vi.useFakeTimers();
    try {
      const onSearch = vi.fn();
      render(<SearchInput label={LABEL} value="hub" onSearch={onSearch} />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onSearch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears at once with the clear button, which only shows when there is text', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput label={LABEL} value="hub" onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearch).toHaveBeenCalledExactlyOnceWith('');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('puts the focus back in the box when it is cleared', async () => {
    const user = userEvent.setup();
    render(<SearchInput label={LABEL} value="hub" onSearch={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
});
