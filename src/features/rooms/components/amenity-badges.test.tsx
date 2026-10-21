import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmenityBadges } from './amenity-badges';

describe('AmenityBadges', () => {
  it('shows each amenity as a labelled badge in a list', () => {
    render(<AmenityBadges amenities={['video_conferencing', 'projector']} />);

    const list = screen.getByRole('list', { name: 'Amenities' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Video conferencing', 'Projector']);
  });

  it('shows a dash when there are none', () => {
    render(<AmenityBadges amenities={[]} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
