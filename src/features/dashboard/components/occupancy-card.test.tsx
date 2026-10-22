import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OccupancyCard } from './occupancy-card';

const ROWS = [
  { locationId: 'loc_1', locationName: 'Canal Yard', bookedHours: 7.5, availableHours: 30 },
  { locationId: 'loc_2', locationName: 'Old Mill', bookedHours: 0, availableHours: 0 },
];

describe('OccupancyCard', () => {
  it('shows each location as a link, its hours and a bar named after it', () => {
    render(<OccupancyCard occupancy={ROWS} />);

    expect(screen.getByRole('heading', { name: 'Occupancy by location' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Canal Yard' })).toHaveAttribute(
      'href',
      '/locations/loc_1',
    );
    expect(screen.getByText('7.5 of 30 h')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Canal Yard occupancy' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
  });

  it('shows an empty bar, not a broken one, for a location with no bookable hours', () => {
    render(<OccupancyCard occupancy={ROWS} />);

    expect(screen.getByText('0 of 0 h')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Old Mill occupancy' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });

  it('says so when there are no active locations', () => {
    render(<OccupancyCard occupancy={[]} />);

    expect(screen.getByText('No active locations.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
