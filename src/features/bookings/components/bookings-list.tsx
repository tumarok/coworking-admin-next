'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AsyncCombobox } from '@/components/async-combobox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, dataTableColumns } from '@/components/data-table';
import { FilterSelect } from '@/components/filter-select';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { BookingStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/config/routes';
import type { Booking, BulkBookingAction } from '@/lib/contract/booking';
import { useListParams } from '@/lib/list-params';
import { formatMoney } from '@/lib/money';
import {
  bookingsQuery,
  memberOptionQuery,
  memberOptionsQuery,
  roomOptionQuery,
  roomOptionsQuery,
} from '@/features/bookings/api/booking-queries';
import { useBulkBookings } from '@/features/bookings/api/booking-mutations';
import { useLocationZones } from '@/features/bookings/api/booking-zones';
import { BulkActionsBar } from '@/features/bookings/components/bulk-actions-bar';
import {
  BulkFailedDialog,
  type BulkFailure,
} from '@/features/bookings/components/bulk-failed-dialog';
import { BookingFormDialog } from '@/features/bookings/components/booking-form-dialog';
import { BookingStatusActions } from '@/features/bookings/components/booking-status-actions';
import {
  bookingCount,
  BULK_DONE,
  FILTER_KEYS,
  FILTER_VALUES,
  locationOptionLabel,
  memberLabel,
  memberText,
  NOT_FOUND_REASON,
  roomLabel,
  roomText,
  STATUS_OPTIONS,
} from '@/features/bookings/constants';
import { bookingRange } from '@/features/bookings/format';

const column = dataTableColumns<Booking>();

/** The bookings screen: search and filters in the URL, a server-paged table, create and edit. */
export function BookingsList() {
  const router = useRouter();
  const params = useListParams(FILTER_KEYS, FILTER_VALUES);
  const bookings = useQuery(bookingsQuery(params.query));
  // Times are the clock of each booking's location; until the zones are known they stay blank.
  const zones = useLocationZones();
  // The dialog keeps its booking after closing, so its title does not change during the fade-out.
  // `null` is "create", a booking is "edit it".
  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<Booking | null>(null);

  // The selection is kept as records, not ids: it outlives the page of rows it was made on, and
  // the dialog that names a refused booking needs its room and time after the rows are gone.
  const [selected, setSelected] = useState<Booking[]>([]);
  const bulk = useBulkBookings();
  // `count` is what the question was asked about, so its title stays put while it fades out; a
  // new `session` gives each question a fresh dialog.
  const [cancelAsk, setCancelAsk] = useState({ open: false, count: 0, session: 0 });
  // The refused bookings of the last request. A new `session` remounts the dialog, so it never
  // shows the previous result for a moment.
  const [refused, setRefused] = useState<{
    action: BulkBookingAction;
    failures: BulkFailure[];
  } | null>(null);
  const [refusedOpen, setRefusedOpen] = useState(false);
  const [session, setSession] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // The selection belongs to what is on screen: a new search or filter starts it again, a new
  // page does not. Adjusting state while rendering is the way React offers for "reset on change".
  const criteria = JSON.stringify([params.q, ...FILTER_KEYS.map((key) => params.filters[key])]);
  const [shownCriteria, setShownCriteria] = useState(criteria);
  if (shownCriteria !== criteria) {
    setShownCriteria(criteria);
    setSelected([]);
  }

  const filtered = params.q !== '' || FILTER_KEYS.some((key) => params.filters[key] !== '');
  const rangeOf = (booking: Booking) =>
    zones.ready ? bookingRange(booking, zones.zoneOf(booking.locationId)) : '…';
  const subjectOf = (booking: Booking) => `${roomText(booking.roomName)}, ${rangeOf(booking)}`;

  const select = (state: Record<string, boolean>) => {
    setSelected(
      Object.keys(state)
        .filter((id) => state[id])
        .flatMap((id) => {
          // The row on screen is the newest copy; the page it came from may be gone.
          const booking =
            bookings.data?.items.find((item) => item.id === id) ??
            selected.find((item) => item.id === id);
          return booking ? [booking] : [];
        }),
    );
  };

  const clearSelection = () => {
    setSelected([]);
    // The button the user pressed is gone, so focus moves to the title.
    titleRef.current?.focus();
  };

  const run = (action: BulkBookingAction) => {
    const asked = selected;
    // These callbacks belong to this component: if it unmounts first (the user navigates away),
    // they do not run. Nothing here needs them then; the cache is refreshed by the mutation itself.
    bulk.mutate(
      { ids: asked.map((booking) => booking.id), action },
      {
        onSuccess: ({ updated, failed }) => {
          setCancelAsk((ask) => ({ ...ask, open: false }));
          if (updated.length > 0) {
            toast.success(`${bookingCount(updated.length)} ${BULK_DONE[action]}`);
          }
          // Changed bookings leave the selection, and so do those that no longer exist; the rest
          // stay for a look or a retry.
          const leaves = new Set([
            ...updated,
            ...failed.filter((item) => item.reason === NOT_FOUND_REASON).map((item) => item.id),
          ]);
          setSelected((current) => current.filter((booking) => !leaves.has(booking.id)));
          if (failed.length > 0) {
            setRefused({
              action,
              failures: failed.map((item) => {
                const booking = asked.find((candidate) => candidate.id === item.id);
                return {
                  id: item.id,
                  subject: booking ? subjectOf(booking) : item.id,
                  reason: item.reason,
                  gone: item.reason === NOT_FOUND_REASON,
                };
              }),
            });
            setSession((current) => current + 1);
            setRefusedOpen(true);
          } else if (action === 'confirm') {
            // No dialog is closing here, and the buttons that had focus are about to go.
            titleRef.current?.focus();
          }
        },
        onError: (error) => {
          setCancelAsk((ask) => ({ ...ask, open: false }));
          toast.error(error.message);
        },
      },
    );
  };

  const columns = column.columns([
    column.display({
      id: 'when',
      header: 'When',
      cell: ({ row }) => (
        <Link
          href={ROUTES.booking(row.original.id)}
          className="font-medium hover:underline focus-visible:underline"
        >
          {rangeOf(row.original)}
        </Link>
      ),
    }),
    column.display({
      id: 'room',
      header: 'Room',
      cell: ({ row }) => (
        <div>
          <div>{roomText(row.original.roomName)}</div>
          <div className="text-xs text-muted-foreground">{row.original.locationName}</div>
        </div>
      ),
    }),
    column.display({
      id: 'member',
      header: 'Member',
      cell: ({ row }) => memberText(row.original.memberName),
    }),
    column.accessor('attendees', { header: 'Attendees' }),
    column.display({
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <BookingStatusBadge status={row.original.status} />,
    }),
    column.display({
      id: 'price',
      header: 'Price',
      cell: ({ row }) => formatMoney(row.original.totalPrice),
    }),
    column.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <BookingStatusActions
            booking={row.original}
            compact={{ subject: subjectOf(row.original) }}
          />
          {(row.original.status === 'pending' || row.original.status === 'confirmed') && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit booking: ${subjectOf(row.original)}`}
              onClick={() => {
                setFormTarget(row.original);
                setFormOpen(true);
              }}
            >
              <PencilIcon aria-hidden />
            </Button>
          )}
        </div>
      ),
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bookings"
        subtitle="Who uses which room, and when"
        titleRef={titleRef}
        actions={
          <Button
            onClick={() => {
              setFormTarget(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon aria-hidden />
            New booking
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search member or room"
          value={params.q}
          onSearch={(text) => void params.setSearch(text)}
        />
        <Input
          type="date"
          aria-label="From date"
          className="w-40"
          value={params.filters.from}
          max={params.filters.to || undefined}
          onChange={(event) => void params.setFilter('from', event.target.value || null)}
        />
        <Input
          type="date"
          aria-label="To date"
          className="w-40"
          value={params.filters.to}
          min={params.filters.from || undefined}
          onChange={(event) => void params.setFilter('to', event.target.value || null)}
        />
        <FilterSelect
          label="Status"
          anyLabel="Any status"
          value={params.filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => void params.setFilter('status', status || null)}
        />
        <FilterSelect
          label="Location"
          anyLabel="Any location"
          value={params.filters.locationId}
          options={(zones.locations ?? []).map((location) => ({
            value: location.id,
            label: locationOptionLabel(location),
          }))}
          onChange={(locationId) => void params.setFilter('locationId', locationId || null)}
        />
        <AsyncCombobox
          aria-label="Room"
          placeholder="Any room"
          clearable
          className="w-56"
          value={params.filters.roomId}
          onChange={(roomId) => void params.setFilter('roomId', roomId || null)}
          searchOptions={roomOptionsQuery}
          itemOptions={roomOptionQuery}
          getValue={(room) => room.id}
          getLabel={roomLabel}
          unknownLabel="Unknown room"
          triggerLabel="Show filter rooms"
          clearLabel="Clear room filter"
          emptyText="No rooms found"
        />
        <AsyncCombobox
          aria-label="Member"
          placeholder="Any member"
          clearable
          className="w-56"
          value={params.filters.memberId}
          onChange={(memberId) => void params.setFilter('memberId', memberId || null)}
          searchOptions={memberOptionsQuery}
          itemOptions={memberOptionQuery}
          getValue={(member) => member.id}
          getLabel={memberLabel}
          unknownLabel="Unknown member"
          triggerLabel="Show filter members"
          clearLabel="Clear member filter"
          emptyText="No members found"
        />
        {filtered && (
          <Button variant="ghost" onClick={() => void params.reset()}>
            Clear filters
          </Button>
        )}
      </div>

      <BulkActionsBar
        count={selected.length}
        running={bulk.isPending ? bulk.variables.action : null}
        onConfirm={() => {
          run('confirm');
        }}
        onCancel={() => {
          setCancelAsk((ask) => ({ open: true, count: selected.length, session: ask.session + 1 }));
        }}
        onClear={clearSelection}
      />

      <DataTable
        caption="Bookings"
        columns={columns}
        rows={bookings.data?.items}
        total={bookings.data?.total ?? 0}
        page={params.page}
        limit={params.limit}
        onPageChange={(page) => void params.setPage(page)}
        onLimitChange={(limit) => void params.setLimit(limit)}
        fetching={bookings.isFetching}
        error={bookings.error}
        onRetry={() => void bookings.refetch()}
        empty={filtered ? 'No bookings match the current filters.' : 'No bookings yet.'}
        selection={{
          state: Object.fromEntries(selected.map((booking) => [booking.id, true])),
          onChange: select,
          locked: bulk.isPending,
        }}
        rowLabel={subjectOf}
      />

      <ConfirmDialog
        key={cancelAsk.session}
        open={cancelAsk.open}
        onOpenChange={(open) => {
          setCancelAsk((ask) => ({ ...ask, open }));
        }}
        title={`Cancel ${bookingCount(cancelAsk.count)}?`}
        description="The rooms are free for other bookings again. This cannot be undone."
        confirmLabel="Cancel bookings"
        destructive
        pending={bulk.isPending}
        onConfirm={() => {
          run('cancel');
        }}
        // The Cancel button of the bar is gone once everything was cancelled; and a list of
        // refused bookings that opens at the same time keeps the focus it was given.
        finalFocus={() => (refusedOpen ? false : selected.length === 0 ? titleRef.current : true)}
      />

      {refused && (
        <BulkFailedDialog
          key={session}
          open={refusedOpen}
          onOpenChange={setRefusedOpen}
          action={refused.action}
          failures={refused.failures}
          finalFocus={titleRef}
        />
      )}

      <BookingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        booking={formTarget ?? undefined}
        onSaved={(saved) => {
          // A new booking opens on its own page; an edited one stays where it is.
          if (formTarget === null) router.push(ROUTES.booking(saved.id));
        }}
      />
    </div>
  );
}
