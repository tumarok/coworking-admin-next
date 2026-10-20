import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('shows the title and the hint', () => {
    render(<EmptyState title="No rooms">Add the first room.</EmptyState>);

    expect(screen.getByRole('heading', { name: 'No rooms' })).toBeInTheDocument();
    expect(screen.getByText('Add the first room.')).toBeInTheDocument();
  });

  it('works without a hint', () => {
    render(<EmptyState title="No rooms" />);

    expect(screen.getByRole('heading', { name: 'No rooms' })).toBeInTheDocument();
  });

  it('follows a change of title and hint', () => {
    const { rerender } = render(<EmptyState title="No rooms">Add the first room.</EmptyState>);

    rerender(<EmptyState title="No members" />);
    expect(screen.getByRole('heading', { name: 'No members' })).toBeInTheDocument();
    expect(screen.queryByText('Add the first room.')).not.toBeInTheDocument();

    rerender(<EmptyState title="No members" />);
    expect(screen.getByRole('heading', { name: 'No members' })).toBeInTheDocument();
  });
});
