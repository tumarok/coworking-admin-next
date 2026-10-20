import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MAIN_CONTENT_ID, SkipLink } from './skip-link';

describe('SkipLink', () => {
  it('points at the main content', () => {
    render(<SkipLink />);

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      `#${MAIN_CONTENT_ID}`,
    );
  });

  it('is the first thing the Tab key reaches', async () => {
    render(
      <>
        <SkipLink />
        <button type="button">Next</button>
      </>,
    );

    await userEvent.tab();

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
  });

  it('renders the same output again', () => {
    const { rerender } = render(<SkipLink />);

    rerender(<SkipLink />);

    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
  });
});
