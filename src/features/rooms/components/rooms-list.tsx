'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { AsyncCombobox } from '@/components/async-combobox';
import { DataTable, dataTableColumns } from '@/components/data-table';
import { FilterSelect } from '@/components/filter-select';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { RoomStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import type { Room } from '@/lib/contract/room';
import { humanize } from '@/lib/humanize';
import { useListParams } from '@/lib/list-params';
import { formatMoney } from '@/lib/money';
import {
  locationOptionQuery,
  locationOptionsQuery,
  roomsQuery,
} from '@/features/rooms/api/room-queries';
import { AmenityBadges } from '@/features/rooms/components/amenity-badges';
import { DeleteRoomDialog } from '@/features/rooms/components/delete-room-dialog';
import { RoomFormDialog } from '@/features/rooms/components/room-form-dialog';
import {
  FILTER_KEYS,
  FILTER_VALUES,
  locationLabel,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from '@/features/rooms/constants';

const column = dataTableColumns<Room>();

/** The rooms screen: search and filters in the URL, a server-paged table, create/edit/delete. */
export function RoomsList() {
  const router = useRouter();
  const params = useListParams(FILTER_KEYS, FILTER_VALUES);
  const rooms = useQuery(roomsQuery(params.query));
  // Dialogs keep their record after closing, so their title does not change during the fade-out.
  // Form: `null` is "create", a room is "edit it".
  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<Room | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  const filtered = params.q !== '' || FILTER_KEYS.some((key) => params.filters[key] !== '');

  const columns = column.columns([
    column.accessor('name', {
      header: 'Name',
      cell: ({ row }) => (
        <Link
          href={ROUTES.room(row.original.id)}
          className="font-medium hover:underline focus-visible:underline"
        >
          {row.original.name}
        </Link>
      ),
    }),
    column.accessor('locationName', { header: 'Location' }),
    column.display({
      id: 'type',
      header: 'Type',
      cell: ({ row }) => humanize(row.original.type),
    }),
    column.display({
      id: 'capacity',
      header: 'Capacity',
      cell: ({ row }) => `${row.original.capacity} seats`,
    }),
    column.display({
      id: 'rate',
      header: 'Rate',
      cell: ({ row }) => `${formatMoney(row.original.hourlyRate)} / hour`,
    }),
    column.display({
      id: 'amenities',
      header: 'Amenities',
      cell: ({ row }) => <AmenityBadges amenities={row.original.amenities} />,
    }),
    column.display({
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <RoomStatusBadge status={row.original.status} />,
    }),
    column.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.original.name}`}
            onClick={() => {
              setFormTarget(row.original);
              setFormOpen(true);
            }}
          >
            <PencilIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${row.original.name}`}
            onClick={() => {
              setDeleteTarget(row.original);
              setDeleteOpen(true);
            }}
          >
            <TrashIcon aria-hidden />
          </Button>
        </div>
      ),
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rooms"
        subtitle="Meeting rooms, offices, desks and event spaces"
        actions={
          <Button
            onClick={() => {
              setFormTarget(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon aria-hidden />
            New room
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search name or location"
          value={params.q}
          onSearch={(text) => void params.setSearch(text)}
        />
        <AsyncCombobox
          aria-label="Location"
          placeholder="Any location"
          clearable
          className="w-56"
          value={params.filters.locationId}
          onChange={(locationId) => void params.setFilter('locationId', locationId || null)}
          searchOptions={locationOptionsQuery}
          itemOptions={locationOptionQuery}
          getValue={(location) => location.id}
          getLabel={locationLabel}
          unknownLabel="Unknown location"
          triggerLabel="Show filter locations"
          clearLabel="Clear location filter"
          emptyText="No locations found"
        />
        <FilterSelect
          label="Type"
          anyLabel="Any type"
          value={params.filters.type}
          options={TYPE_OPTIONS}
          onChange={(type) => void params.setFilter('type', type || null)}
        />
        <FilterSelect
          label="Status"
          anyLabel="Any status"
          value={params.filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => void params.setFilter('status', status || null)}
        />
        {filtered && (
          <Button variant="ghost" onClick={() => void params.reset()}>
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        caption="Rooms"
        columns={columns}
        rows={rooms.data?.items}
        total={rooms.data?.total ?? 0}
        page={params.page}
        limit={params.limit}
        onPageChange={(page) => void params.setPage(page)}
        onLimitChange={(limit) => void params.setLimit(limit)}
        fetching={rooms.isFetching}
        error={rooms.error}
        onRetry={() => void rooms.refetch()}
        rowLabel={(room) => room.name}
        empty={filtered ? 'No rooms match the current filters.' : 'No rooms yet.'}
      />

      <RoomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        room={formTarget ?? undefined}
        onSaved={(saved) => {
          // A new room opens on its own page; an edited one stays where it is.
          if (formTarget === null) router.push(ROUTES.room(saved.id));
        }}
      />
      <DeleteRoomDialog room={deleteTarget} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
