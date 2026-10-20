import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('shows the title as the page heading', () => {
    render(<PageHeader title="Rooms" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Rooms' })).toBeInTheDocument();
  });

  it('shows the subtitle and the actions when given', () => {
    render(<PageHeader title="Rooms" subtitle="12 rooms" actions={<button>Add room</button>} />);

    expect(screen.getByText('12 rooms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add room' })).toBeInTheDocument();
  });

  it('shows the subtitle without actions and the actions without a subtitle', () => {
    const { rerender } = render(<PageHeader title="Rooms" subtitle="12 rooms" />);
    expect(screen.getByText('12 rooms')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<PageHeader title="Rooms" actions={<button>Add room</button>} />);
    expect(screen.queryByText('12 rooms')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add room' })).toBeInTheDocument();
  });

  it('renders the same output again for the same props', () => {
    const { rerender } = render(<PageHeader title="Rooms" subtitle="12 rooms" />);

    rerender(<PageHeader title="Rooms" subtitle="12 rooms" />);

    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument();
  });
});
