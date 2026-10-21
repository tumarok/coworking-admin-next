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
import { MemberStatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { memberFullName, type Member } from '@/lib/contract/member';
import { formatDate } from '@/lib/format-date';
import { humanize } from '@/lib/humanize';
import { useListParams } from '@/lib/list-params';
import { membersQuery } from '@/features/members/api/member-queries';
import { DeleteMemberDialog } from '@/features/members/components/delete-member-dialog';
import { MemberFormDialog } from '@/features/members/components/member-form-dialog';
import {
  FILTER_KEYS,
  FILTER_VALUES,
  PLAN_OPTIONS,
  STATUS_OPTIONS,
} from '@/features/members/constants';

const column = dataTableColumns<Member>();

/** The members screen: search and filters in the URL, a server-paged table, create/edit/delete. */
export function MembersList() {
  const router = useRouter();
  const params = useListParams(FILTER_KEYS, FILTER_VALUES);
  const members = useQuery(membersQuery(params.query));
  // Dialogs keep their record after closing, so their title does not change during the fade-out.
  // Form: `null` is "create", a member is "edit them".
  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<Member | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  const filtered = params.q !== '' || FILTER_KEYS.some((key) => params.filters[key] !== '');

  const columns = column.columns([
    column.display({
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          href={ROUTES.member(row.original.id)}
          className="font-medium hover:underline focus-visible:underline"
        >
          {memberFullName(row.original)}
        </Link>
      ),
    }),
    column.accessor('email', { header: 'Email' }),
    column.display({
      id: 'company',
      header: 'Company',
      // Company names can be long: they wrap instead of pushing the status and actions off screen.
      cell: ({ row }) => (
        <span className="block max-w-40 whitespace-normal">{row.original.company ?? '—'}</span>
      ),
    }),
    column.display({
      id: 'plan',
      header: 'Plan',
      cell: ({ row }) => humanize(row.original.plan),
    }),
    column.display({
      id: 'joinedAt',
      header: 'Member since',
      cell: ({ row }) => formatDate(row.original.joinedAt),
    }),
    column.display({
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <MemberStatusBadge status={row.original.status} />,
    }),
    column.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${memberFullName(row.original)}`}
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
            aria-label={`Delete ${memberFullName(row.original)}`}
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
        title="Members"
        subtitle="People and teams with a plan"
        actions={
          <Button
            onClick={() => {
              setFormTarget(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon aria-hidden />
            New member
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search name, email or company"
          value={params.q}
          onSearch={(text) => void params.setSearch(text)}
        />
        <FilterSelect
          label="Plan"
          anyLabel="Any plan"
          value={params.filters.plan}
          options={PLAN_OPTIONS}
          onChange={(plan) => void params.setFilter('plan', plan || null)}
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
        caption="Members"
        columns={columns}
        rows={members.data?.items}
        total={members.data?.total ?? 0}
        page={params.page}
        limit={params.limit}
        onPageChange={(page) => void params.setPage(page)}
        onLimitChange={(limit) => void params.setLimit(limit)}
        fetching={members.isFetching}
        error={members.error}
        onRetry={() => void members.refetch()}
        rowLabel={memberFullName}
        empty={filtered ? 'No members match the current filters.' : 'No members yet.'}
      />

      <MemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        member={formTarget ?? undefined}
        onSaved={(saved) => {
          // A new member opens on their own page; an edited one stays where they are.
          if (formTarget === null) router.push(ROUTES.member(saved.id));
        }}
      />
      <DeleteMemberDialog member={deleteTarget} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
