'use client';

import {
  createColumnHelper,
  functionalUpdate,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
} from '@tanstack/react-table';
import { createContext, use, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/pagination';
import { cn } from '@/lib/utils';

// Module level: the table needs stable references for features, columns and fallback rows.
const features = tableFeatures({ rowPaginationFeature, rowSelectionFeature });

export type DataTableColumn<T extends RowData> = ColumnDef<typeof features, T>;

/** Typed helper to declare the columns of a `DataTable`. Write cells inline in the column def. */
export const dataTableColumns = <T extends RowData>() => createColumnHelper<typeof features, T>();

const NO_ROWS: never[] = [];
const SKELETON_ROWS = 5;

// Names the checkbox of a row. It travels by context so that the select column below can stay a
// module-level constant: new column definitions on every render would remount the checkboxes.
const RowLabelContext = createContext<((row: never) => string) | undefined>(undefined);

function RowCheckbox({
  original,
  checked,
  onCheckedChange,
}: {
  original: { id: string };
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const rowLabel = use(RowLabelContext);
  return (
    <Checkbox
      aria-label={rowLabel ? `Select ${rowLabel(original as never)}` : 'Select row'}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  );
}

const selectColumn = dataTableColumns<{ id: string }>().display({
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      aria-label="Select all rows on this page"
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
      onCheckedChange={(checked) => {
        table.toggleAllPageRowsSelected(checked);
      }}
    />
  ),
  cell: ({ row }) => (
    <RowCheckbox
      original={row.original}
      checked={row.getIsSelected()}
      onCheckedChange={(checked) => {
        row.toggleSelected(checked);
      }}
    />
  ),
});

interface DataTableProps<T extends RowData & { id: string }> {
  /** Accessible name of the table. */
  caption: string;
  columns: DataTableColumn<T>[];
  /** Rows of the current page; `undefined` while the first response is on its way. */
  rows: T[] | undefined;
  /** Rows on all pages, as the server counts them. */
  total: number;
  /** 1-based page and page size, taken from the URL. */
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  /** A new page size starts again from page 1; the owner of the URL state does that. */
  onLimitChange: (limit: number) => void;
  /** Rows are being fetched, possibly again: keeps the old rows and marks the table busy. */
  fetching?: boolean;
  /** The failed request behind `rows`; with no rows to show it replaces the skeleton. */
  error?: Error | null;
  /** Retries the request after a failed first load. */
  onRetry?: () => void;
  /** Shown when the page has no rows. */
  empty?: React.ReactNode;
  /** Adds a checkbox column. Selected rows are kept by id, so they survive a page change. */
  selection?: { state: RowSelectionState; onChange: (state: RowSelectionState) => void };
  /** Names a row for its checkbox ("Select Atrium"), so a screen reader can tell rows apart. */
  rowLabel?: (row: T) => string;
}

/**
 * Table of a server-paged list. TanStack Table holds the rows, the selection and the page numbers;
 * the server does the paging, so nothing is sliced or counted here.
 */
export function DataTable<T extends RowData & { id: string }>({
  caption,
  columns,
  rows,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  fetching = false,
  error = null,
  onRetry,
  empty = 'No results.',
  selection,
  rowLabel,
}: DataTableProps<T>) {
  const table = useTable({
    features,
    // The checkbox column only touches row ids and selection, so it fits any row type.
    columns: selection ? [selectColumn as unknown as DataTableColumn<T>, ...columns] : columns,
    data: rows ?? NO_ROWS,
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: total,
    state: {
      pagination: { pageIndex: page - 1, pageSize: limit },
      rowSelection: selection?.state ?? {},
    },
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, { pageIndex: page - 1, pageSize: limit });
      if (next.pageSize === limit) onPageChange(next.pageIndex + 1);
      else onLimitChange(next.pageSize);
    },
    onRowSelectionChange: (updater) => {
      selection?.onChange(functionalUpdate(updater, selection.state));
    },
  });

  const failed = rows === undefined && error !== null;
  const loading = rows === undefined && !failed;
  const pageCount = table.getPageCount();
  const lastPage = Math.max(pageCount, 1);

  // A page past the end (a stale URL, or the last row of the last page was deleted) has no rows:
  // go to the last page instead of showing an empty table.
  useEffect(() => {
    if (rows !== undefined && total > 0 && page > lastPage) onPageChange(lastPage);
  }, [rows, total, page, lastPage, onPageChange]);

  const columnCount = table.getAllColumns().length;

  return (
    <RowLabelContext value={rowLabel}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table aria-busy={loading || fetching}>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 bg-muted/50 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(fetching && 'opacity-60 transition-opacity')}>
            {loading &&
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: columnCount }, (_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {failed && (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center whitespace-normal">
                  <div role="alert" className="flex flex-col items-center gap-2">
                    <p className="text-sm text-destructive">{error.message}</p>
                    {onRetry && (
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Retry
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading && !failed && table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              !failed &&
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          pageCount={pageCount}
          limit={limit}
          total={total}
          onPageChange={(next) => {
            table.setPageIndex(next - 1);
          }}
          onLimitChange={(next) => {
            table.setPageSize(next);
          }}
        />
      </div>
    </RowLabelContext>
  );
}
