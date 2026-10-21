'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { DataTable, dataTableColumns } from '@/components/data-table';
import { FilterSelect } from '@/components/filter-select';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { LocationStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import type { Location } from '@/lib/contract/location';
import { useListParams } from '@/lib/list-params';
import { locationsQuery } from '@/features/locations/api/location-queries';
import { DeleteLocationDialog } from '@/features/locations/components/delete-location-dialog';
import { LocationFormDialog } from '@/features/locations/components/location-form-dialog';
import { FILTER_KEYS, FILTER_VALUES, STATUS_OPTIONS } from '@/features/locations/constants';

const column = dataTableColumns<Location>();

/** The locations screen: search and filters in the URL, a server-paged table, create/edit/delete. */
export function LocationsList() {
  const router = useRouter();
  const params = useListParams(FILTER_KEYS, FILTER_VALUES);
  const locations = useQuery(locationsQuery(params.query));
  // Dialogs keep their record after closing, so their title does not change during the fade-out.
  // Form: `null` is "create", a location is "edit it".
  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<Location | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const filtered = params.q !== '' || params.filters.status !== '';

  const columns = column.columns([
    column.accessor('name', {
      header: 'Name',
      cell: ({ row }) => (
        <Link
          href={ROUTES.location(row.original.id)}
          className="font-medium hover:underline focus-visible:underline"
        >
          {row.original.name}
        </Link>
      ),
    }),
    column.accessor('city', { header: 'City' }),
    column.accessor('address', { header: 'Address' }),
    column.display({
      id: 'hours',
      header: 'Hours',
      cell: ({ row }) => `${row.original.opensAt}–${row.original.closesAt}`,
    }),
    column.accessor('roomCount', { header: 'Rooms' }),
    column.display({
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <LocationStatusBadge status={row.original.status} />,
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
        title="Locations"
        subtitle="Spaces in the network and their opening hours"
        actions={
          <Button
            onClick={() => {
              setFormTarget(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon aria-hidden />
            New location
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search name, city or address"
          value={params.q}
          onSearch={(text) => void params.setSearch(text)}
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
        caption="Locations"
        columns={columns}
        rows={locations.data?.items}
        total={locations.data?.total ?? 0}
        page={params.page}
        limit={params.limit}
        onPageChange={(page) => void params.setPage(page)}
        onLimitChange={(limit) => void params.setLimit(limit)}
        fetching={locations.isFetching}
        error={locations.error}
        onRetry={() => void locations.refetch()}
        rowLabel={(location) => location.name}
        empty={filtered ? 'No locations match the current filters.' : 'No locations yet.'}
      />

      <LocationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        location={formTarget ?? undefined}
        onSaved={(saved) => {
          // A new location opens on its own page; an edited one stays where it is.
          if (formTarget === null) router.push(ROUTES.location(saved.id));
        }}
      />
      <DeleteLocationDialog
        location={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
