import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BOOKING_STATUSES } from '@/lib/contract/booking';
import { humanize } from '@/lib/humanize';
import { StatusCard } from './status-card';

// The bars are hidden from readers (the counts are read), so they are asked for as hidden.
const bars = () => screen.getAllByRole('presentation', { hidden: true });

describe('StatusCard', () => {
  it('lists all six statuses in the order of the contract, each with its count', () => {
    render(
      <StatusCard
        byStatus={{
          pending: 2,
          confirmed: 8,
          checked_in: 1,
          completed: 4,
          cancelled: 0,
          no_show: 3,
        }}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(
      BOOKING_STATUSES.map((status, index) => `${humanize(status)}${[2, 8, 1, 4, 0, 3][index]}`),
    );
    expect(within(rows[1] as HTMLElement).getByText('8')).toBeInTheDocument();
  });

  it('draws the bars in proportion to the longest one', () => {
    render(
      <StatusCard
        byStatus={{
          pending: 2,
          confirmed: 8,
          checked_in: 0,
          completed: 4,
          cancelled: 0,
          no_show: 0,
        }}
      />,
    );

    expect(bars().map((bar) => bar.style.width)).toEqual(['25%', '100%', '0%', '50%', '0%', '0%']);
  });

  it('draws no bar at all when every count is zero', () => {
    render(
      <StatusCard
        byStatus={{
          pending: 0,
          confirmed: 0,
          checked_in: 0,
          completed: 0,
          cancelled: 0,
          no_show: 0,
        }}
      />,
    );

    expect(bars().map((bar) => bar.style.width)).toEqual(Array(6).fill('0%'));
  });
});
