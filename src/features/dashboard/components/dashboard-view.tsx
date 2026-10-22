'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import { formatDate, todayUtc } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { dashboardQuery } from '@/features/dashboard/api/dashboard-queries';
import { KpiCards } from '@/features/dashboard/components/kpi-cards';
import { OccupancyCard } from '@/features/dashboard/components/occupancy-card';
import { StatusCard } from '@/features/dashboard/components/status-card';
import { UpcomingCard } from '@/features/dashboard/components/upcoming-card';
import { isDateParam } from '@/features/dashboard/constants';

const dateParam = parseAsString
  .withDefault('')
  .withOptions({ history: 'replace', shallow: true, clearOnDefault: true });

/**
 * The dashboard: figures of one day, chosen in the URL (`?date=`). The day is a UTC calendar day,
 * because that is how the API cuts days; the date field and the subtitle show the day the figures
 * are for. No date in the URL (or one the API would refuse) is the API's today.
 */
export function DashboardView() {
  const [param, setParam] = useQueryState('date', dateParam);
  // The day last picked in the field, for the moment between picking it and its figures arriving.
  const [picked, setPicked] = useState('');
  // Today is not a day of its own: the API answers for it when no date is given, so a hand-typed
  // `?date=<today>` is the same request, and it leaves the URL.
  const isToday = isDateParam(param) && param === todayUtc();
  const date = isDateParam(param) && !isToday ? param : '';
  useEffect(() => {
    if (isToday) void setParam(null);
  }, [isToday, setParam]);

  const dashboard = useQuery(dashboardQuery(date));
  const { data } = dashboard;
  // Figures of another day than the one asked for stay on screen, dimmed, until the new ones come.
  const refreshing = data !== undefined && dashboard.isFetching;
  // A rejected session is on its way to the login page; that is not a failure to explain.
  const leaving = dashboard.error instanceof ApiError && dashboard.error.status === 401;
  // The field shows the day asked for; without a date that is the day of the figures, once known.
  const fieldValue = date || (dashboard.isPlaceholderData ? picked : (data?.date ?? ''));

  const header = (
    <PageHeader
      title="Dashboard"
      subtitle={data ? `Across all locations on ${formatDate(data.date)}` : 'Across all locations'}
      actions={
        <Input
          type="date"
          aria-label="Date"
          value={fieldValue}
          className="w-auto"
          onChange={(event) => {
            const next = event.target.value;
            setPicked(next);
            void setParam(next === '' || next === todayUtc() ? null : next);
          }}
        />
      }
    />
  );

  if (data === undefined && dashboard.isError && !leaving) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div role="alert">
          <EmptyState title="Could not load the dashboard">
            <p>{dashboard.error.message}</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => void dashboard.refetch()}
            >
              Retry
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {header}
        <p role="status" className="sr-only">
          Loading the dashboard…
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 min-[56.25rem]:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      {dashboard.isRefetchError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive"
        >
          <span>Could not refresh the dashboard: {dashboard.error.message}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={dashboard.isFetching}
            onClick={() => void dashboard.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      <div
        role="group"
        aria-label="Dashboard figures"
        aria-busy={refreshing}
        className={cn('flex flex-col gap-6 transition-opacity', refreshing && 'opacity-70')}
      >
        <KpiCards kpis={data.kpis} />
        <div className="grid gap-6 min-[56.25rem]:grid-cols-2">
          <OccupancyCard occupancy={data.occupancy} />
          <StatusCard byStatus={data.byStatus} />
        </div>
        <UpcomingCard upcoming={data.upcoming} />
      </div>
    </div>
  );
}
