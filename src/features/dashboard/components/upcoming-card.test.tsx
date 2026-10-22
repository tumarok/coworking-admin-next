import { http, HttpResponse } from 'msw';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dashboardSchema, type Dashboard } from '@/lib/contract/dashboard';
import { formatTimeRange } from '@/lib/format-date';
import { humanize } from '@/lib/humanize';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { UpcomingCard } from './upcoming-card';

/** The upcoming bookings the mock API reports for its fixed "now". */
const upcoming = async (): Promise<Dashboard['upcoming']> =>
  dashboardSchema.parse(await (await fetch('/bff/dashboard')).json()).upcoming;

describe('UpcomingCard', () => {
  it('lists each booking: its time on the clock of its location, room, member and status', async () => {
    const api = installMockApi({ via: 'bff' });
    const bookings = await upcoming();
    expect(bookings.length).toBeGreaterThan(0);

    renderWithProviders(<UpcomingCard upcoming={bookings} />);

    expect(screen.getByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(bookings.length);
    for (const [index, booking] of bookings.entries()) {
      const zone = api.db.locations.find((l) => l.id === booking.locationId)?.timezone ?? '';
      const row = within(rows[index] as HTMLElement);
      const range = formatTimeRange(booking.startsAt, booking.endsAt, zone);
      expect(await row.findByRole('link', { name: range })).toHaveAttribute(
        'href',
        `/bookings/${booking.id}`,
      );
      expect(row.getByText(`${booking.roomName} · ${booking.locationName}`)).toBeInTheDocument();
      expect(row.getByText(booking.memberName)).toBeInTheDocument();
      expect(row.getByText(humanize(booking.status))).toBeInTheDocument();
    }
  });

  it('links to all bookings', async () => {
    installMockApi({ via: 'bff' });

    renderWithProviders(<UpcomingCard upcoming={await upcoming()} />);

    expect(screen.getByRole('link', { name: 'All bookings' })).toHaveAttribute('href', '/bookings');
  });

  it('says so when nothing is scheduled', () => {
    installMockApi({ via: 'bff' });

    renderWithProviders(<UpcomingCard upcoming={[]} />);

    expect(screen.getByText('Nothing scheduled.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All bookings' })).toBeInTheDocument();
  });

  it('prints a placeholder until it knows the zones, then the times', async () => {
    installMockApi({ via: 'bff' });
    const bookings = await upcoming();

    renderWithProviders(<UpcomingCard upcoming={bookings.slice(0, 1)} />);

    expect(screen.getByRole('link', { name: '…' })).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /\d{2}:\d{2}–\d{2}:\d{2}$/ }),
    ).toBeInTheDocument();
  });

  it('falls back to UTC, and says so, when the zones cannot be read', async () => {
    installMockApi({ via: 'bff' });
    const bookings = (await upcoming()).slice(0, 1);
    server.use(
      http.get('*/bff/locations', () => HttpResponse.json({ message: 'down' }, { status: 500 })),
    );

    renderWithProviders(<UpcomingCard upcoming={bookings} />);

    const booking = bookings[0] as Dashboard['upcoming'][number];
    expect(
      await screen.findByRole('link', {
        name: `${formatTimeRange(booking.startsAt, booking.endsAt, 'UTC')} UTC`,
      }),
    ).toBeInTheDocument();
  });
});
