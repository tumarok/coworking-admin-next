import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorView } from './error-view';

const mode = vi.hoisted(() => ({ development: true }));
vi.mock('@/config/runtime', () => ({
  get IS_DEVELOPMENT() {
    return mode.development;
  },
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorView', () => {
  it('shows the message in development', () => {
    mode.development = true;
    render(<ErrorView error={new Error('Boom')} retry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('shows only the digest in production', () => {
    mode.development = false;
    render(
      <ErrorView
        error={Object.assign(new Error('Secret'), { digest: 'abc123' })}
        retry={vi.fn()}
      />,
    );

    expect(screen.getByText('Error code: abc123')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('shows a plain text in production without a digest', () => {
    mode.development = false;
    render(<ErrorView error={new Error('Secret')} retry={vi.fn()} />);

    expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
  });

  it('logs the error and retries on demand', async () => {
    const error = new Error('Boom');
    const retry = vi.fn();
    render(<ErrorView error={error} retry={retry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(console.error).toHaveBeenCalledWith(error);
    expect(retry).toHaveBeenCalledOnce();
  });

  it('follows a new error and renders the same output again', () => {
    mode.development = true;
    const retry = vi.fn();
    const { rerender } = render(<ErrorView error={new Error('First')} retry={retry} />);

    rerender(<ErrorView error={new Error('Second')} retry={retry} />);

    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
