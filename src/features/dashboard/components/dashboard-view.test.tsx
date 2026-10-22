import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endSignOut } from '@/lib/api/client';
import { dashboardSchema, type Dashboard } from '@/lib/contract/dashboard';
import { formatMoney } from '@/lib/money';
import { installMockApi, TEST_NOW } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { dashboardKeys } from '@/features/dashboard/api/dashboard-keys';
import { DashboardView } from './dashboard-view';

let api: ReturnType<typeof installMockApi>;

beforeEach(() => {
  api = installMockApi({ via: 'bff' });
});

const TODAY = '2026-10-14';

/** What the mock API reports for a day (empty: its own today). */
const reported = async (date = ''): Promise<Dashboard> =>
  dashboardSchema.parse(await (await fetch(`/bff/dashboard${date ? `?date=${date}` : ''}`)).json());

/** A day other than today on which the seeded data has bookings. */
const busyDay = () => {
  const day = api.db.bookings
    .map((b) => b.startsAt.slice(0, 10))
    .find((d) => d !== TODAY && d > TODAY);
  if (!day) throw new Error('the seed has no booking on a later day');
  return day;
};

/** Records the dashboard requests. */
const watchRequests = () => {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/bff/dashboard', ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return undefined;
    }),
  );
  return queries;
};

/** The clock of the page, fixed to the day of the mock API. Only `Date`: requests keep moving. */
const today = () => vi.useFakeTimers({ toFake: ['Date'], now: TEST_NOW });

/** Waits for the figures of the first day. */
const loaded = () => screen.findByRole('region', { name: 'Key figures' });

describe('DashboardView', () => {
  it('shows the title, the day and every widget with what the API reports', async () => {
    today();
    const data = await reported();

    renderWithProviders(<DashboardView />);
    const figures = await loaded();

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Across all locations on 14 Oct 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
    expect(within(figures).getByText(String(data.kpis.bookingsToday))).toBeInTheDocument();
    expect(
      within(figures).getByText(`${Math.round(data.kpis.occupancyRate * 100)}%`),
    ).toBeInTheDocument();
    expect(within(figures).getByText(formatMoney(data.kpis.revenueMonth))).toBeInTheDocument();
    expect(within(figures).getByText(String(data.kpis.activeMembers))).toBeInTheDocument();
    for (const row of data.occupancy) {
      expect(
        screen.getByRole('progressbar', { name: `${row.locationName} occupancy` }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: row.locationName })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'Bookings by status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: /\d{2}:\d{2}–\d{2}:\d{2}$/ })).toHaveLength(
      data.upcoming.length,
    );
  });

  it('computes occupancy per location from the hours the API gives', async () => {
    today();
    const data = await reported();

    renderWithProviders(<DashboardView />);
    await loaded();

    for (const row of data.occupancy) {
      const percent =
        row.availableHours > 0 ? Math.round((row.bookedHours / row.availableHours) * 100) : 0;
      expect(
        screen.getByRole('progressbar', { name: `${row.locationName} occupancy` }),
      ).toHaveAttribute('aria-valuenow', String(Math.min(100, percent)));
      expect(
        screen.getAllByText(`${row.bookedHours} of ${row.availableHours} h`).length,
      ).toBeGreaterThan(0);
    }
  });

  it('shows a loading state with the title while the figures come', async () => {
    today();
    server.use(
      http.get('*/bff/dashboard', async () => {
        await delay(100);
        return undefined;
      }),
    );

    renderWithProviders(<DashboardView />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading the dashboard…');
    // No day is named before the figures say which day they are for.
    expect(screen.getByText('Across all locations')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Key figures' })).not.toBeInTheDocument();
    await loaded();
    expect(screen.queryByText('Loading the dashboard…')).not.toBeInTheDocument();
  });

  it('puts another day in the URL, asks for it once and shows it', async () => {
    today();
    const day = busyDay();
    const data = await reported(day);
    const queries = watchRequests();
    const { lastUrl } = renderWithProviders(<DashboardView />);
    await loaded();
    expect(queries).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: day } });

    await waitFor(() => {
      expect(
        screen.getByText(`Across all locations on ${Number(day.slice(8))} `, { exact: false }),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(queries).toHaveLength(2);
    });
    expect(lastUrl()).toBe(`?date=${day}`);
    expect(queries[1]?.get('date')).toBe(day);
    expect(screen.getByLabelText('Date')).toHaveValue(day);
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Key figures' })).toHaveTextContent(
        String(data.kpis.bookingsToday),
      );
    });
    expect(queries).toHaveLength(2);
  });

  it('drops the date from the URL when today is picked, or the field is cleared', async () => {
    today();
    const queries = watchRequests();
    const day = busyDay();
    const { lastUrl } = renderWithProviders(<DashboardView />, { searchParams: `?date=${day}` });
    await loaded();
    expect(screen.getByLabelText('Date')).toHaveValue(day);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: TODAY } });
    // The field keeps the day that was picked while its figures load, instead of falling back to
    // the day of the figures still on screen.
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
    await waitFor(() => {
      expect(lastUrl()).toBe('');
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
    });
    // The API's own today: asked for without a date.
    expect(queries.at(-1)?.has('date')).toBe(false);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: day } });
    await waitFor(() => {
      expect(lastUrl()).toBe(`?date=${day}`);
    });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    await waitFor(() => {
      expect(lastUrl()).toBe('');
    });
  });

  it('starts from the date in the URL', async () => {
    today();
    const queries = watchRequests();
    const day = busyDay();

    renderWithProviders(<DashboardView />, { searchParams: `?date=${day}` });
    await loaded();

    expect(queries[0]?.get('date')).toBe(day);
    expect(screen.getByLabelText('Date')).toHaveValue(day);
  });

  it.each(['garbage', '2026-02-30', '14-10-2026'])(
    'treats the date "%s" in the URL as today, without asking the API for it',
    async (bad) => {
      today();
      const queries = watchRequests();

      renderWithProviders(<DashboardView />, { searchParams: `?date=${bad}` });
      await loaded();

      expect(queries).toHaveLength(1);
      expect(queries[0]?.has('date')).toBe(false);
      expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
      expect(screen.getByText('Across all locations on 14 Oct 2026')).toBeInTheDocument();
    },
  );

  it('dims the old figures, and marks them busy, while another day loads', async () => {
    today();
    const day = busyDay();
    renderWithProviders(<DashboardView />);
    await loaded();
    const content = screen.getByRole('group', { name: 'Dashboard figures' });
    expect(content).toHaveAttribute('aria-busy', 'false');
    expect(content).not.toHaveClass('opacity-70');
    const gate = Promise.withResolvers<undefined>();
    server.use(
      http.get('*/bff/dashboard', async () => {
        await gate.promise;
        return undefined;
      }),
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: day } });

    try {
      await waitFor(() => {
        expect(content).toHaveAttribute('aria-busy', 'true');
      });
      expect(content).toHaveClass('opacity-70');
      expect(screen.getByRole('region', { name: 'Key figures' })).toBeInTheDocument();
    } finally {
      gate.resolve(undefined);
    }
    await waitFor(() => {
      expect(content).toHaveAttribute('aria-busy', 'false');
    });
    expect(content).not.toHaveClass('opacity-70');
  });

  it('says so when nothing is scheduled', async () => {
    today();
    const data = await reported();
    server.use(http.get('*/bff/dashboard', () => HttpResponse.json({ ...data, upcoming: [] })));

    renderWithProviders(<DashboardView />);

    expect(await screen.findByText('Nothing scheduled.')).toBeInTheDocument();
  });

  it('explains a failed load, without a toast, and loads again on retry', async () => {
    today();
    let calls = 0;
    server.use(
      http.get('*/bff/dashboard', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ message: 'The statistics are down' }, { status: 500 })
          : undefined;
      }),
    );

    const { user } = renderWithProviders(<DashboardView />);

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'Could not load the dashboard' }),
    ).toBeInTheDocument();
    expect(within(alert).getByText('The statistics are down')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await loaded()).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Could not load the dashboard' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the figures and offers a retry when only the refresh fails', async () => {
    today();
    const { queryClient, user } = renderWithProviders(<DashboardView />);
    await loaded();
    let failing = true;
    server.use(
      http.get('*/bff/dashboard', () =>
        failing ? HttpResponse.json({ message: 'Try later' }, { status: 503 }) : undefined,
      ),
    );

    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not refresh the dashboard: Try later');
    expect(screen.getByRole('region', { name: 'Key figures' })).toBeInTheDocument();

    failing = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it("takes a hand-typed date of today out of the URL and asks for the API's today", async () => {
    today();
    const queries = watchRequests();

    const { lastUrl } = renderWithProviders(<DashboardView />, {
      searchParams: `?date=${TODAY}`,
    });
    await loaded();

    await waitFor(() => {
      expect(lastUrl()).toBe('');
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]?.has('date')).toBe(false);
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
  });

  it('disables Retry in the refresh banner while the figures are loading again', async () => {
    today();
    const { queryClient, user } = renderWithProviders(<DashboardView />);
    await loaded();
    const gate = Promise.withResolvers<undefined>();
    let calls = 0;
    server.use(
      http.get('*/bff/dashboard', async () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ message: 'down' }, { status: 500 });
        await gate.promise;
        return undefined;
      }),
    );
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    try {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
      });
    } finally {
      gate.resolve(undefined);
    }
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('goes to the login page, with no failure shown, when the session has ended', async () => {
    today();
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/', search: '', assign });
    try {
      server.use(
        http.get('*/bff/dashboard', () =>
          HttpResponse.json({ message: 'Authentication required' }, { status: 401 }),
        ),
      );

      renderWithProviders(<DashboardView />);

      await waitFor(() => {
        expect(assign).toHaveBeenCalledWith('/login');
      });
      expect(
        screen.queryByRole('heading', { name: 'Could not load the dashboard' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      endSignOut();
    }
  });
});
