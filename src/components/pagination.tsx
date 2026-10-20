'use client';

import { useId } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_SIZES } from '@/config/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Disabled but still focusable: a button that disables itself under the keyboard must not drop
// focus to the page body. Base UI sets `aria-disabled` and ignores the click.
const EDGE_BUTTON = 'aria-disabled:pointer-events-none aria-disabled:opacity-50';

interface PaginationProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

/** Page controls of a server-paged list: the range shown, the page size and first/prev/next/last. */
export function Pagination({
  page,
  pageCount,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  const sizeLabelId = useId();
  const lastPage = Math.max(pageCount, 1);
  // A page past the end (a stale URL) is shown as the last one while the owner corrects it.
  const current = Math.min(page, lastPage);
  const first = total === 0 ? 0 : (current - 1) * limit + 1;
  const last = Math.min(current * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"
    >
      <p aria-live="polite" className="text-muted-foreground">
        {first}–{last} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span id={sizeLabelId} className="text-muted-foreground">
            Rows per page
          </span>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              if (value) onLimitChange(Number(value));
            }}
          >
            <SelectTrigger size="sm" aria-labelledby={sizeLabelId} className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground">
          Page {current} of {lastPage}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="First page"
            disabled={current <= 1}
            focusableWhenDisabled
            className={EDGE_BUTTON}
            onClick={() => {
              onPageChange(1);
            }}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={current <= 1}
            focusableWhenDisabled
            className={EDGE_BUTTON}
            onClick={() => {
              onPageChange(current - 1);
            }}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={current >= lastPage}
            focusableWhenDisabled
            className={EDGE_BUTTON}
            onClick={() => {
              onPageChange(current + 1);
            }}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Last page"
            disabled={current >= lastPage}
            focusableWhenDisabled
            className={EDGE_BUTTON}
            onClick={() => {
              onPageChange(lastPage);
            }}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </nav>
  );
}
