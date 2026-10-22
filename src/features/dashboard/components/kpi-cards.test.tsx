import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatMoney } from '@/lib/money';
import { KpiCards } from './kpi-cards';

describe('KpiCards', () => {
  it('prints the four figures, each under its label, in one landmark', () => {
    render(
      <KpiCards
        kpis={{ bookingsToday: 12, occupancyRate: 0.456, revenueMonth: 123450, activeMembers: 87 }}
      />,
    );

    const figures = screen.getByRole('region', { name: 'Key figures' });
    expect(within(figures).getByText('12')).toBeInTheDocument();
    expect(within(figures).getByText('46%')).toBeInTheDocument();
    expect(within(figures).getByText(formatMoney(123450))).toBeInTheDocument();
    expect(within(figures).getByText('87')).toBeInTheDocument();
    for (const label of ['Bookings', 'Occupancy', 'Revenue this month', 'Active members']) {
      expect(within(figures).getByText(label)).toBeInTheDocument();
    }
  });

  it('prints zeros as zeros', () => {
    render(
      <KpiCards kpis={{ bookingsToday: 0, occupancyRate: 0, revenueMonth: 0, activeMembers: 0 }} />,
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText(formatMoney(0))).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });
});
