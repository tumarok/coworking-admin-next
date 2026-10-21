'use client';

import { useId } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { MAX_BULK_BOOKINGS, type BulkBookingAction } from '@/lib/contract/booking';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
  /** How many bookings are selected, on every page. */
  count: number;
  /** The action whose request is running; both buttons wait for it. */
  running: BulkBookingAction | null;
  onConfirm: () => void;
  /** Asks for the confirmation first: the list owns that dialog. */
  onCancel: () => void;
  onClear: () => void;
}

/**
 * What can be done with the selected bookings. Dialogs and results belong to the list, so they
 * stay on screen when the selection, and with it the buttons, is gone. The status line is always
 * mounted, empty while nothing is selected: a live region is only announced if it was there before
 * its text changed.
 */
export function BulkActionsBar({
  count,
  running,
  onConfirm,
  onCancel,
  onClear,
}: BulkActionsBarProps) {
  const limitId = useId();
  const selecting = count > 0;
  const tooMany = count > MAX_BULK_BOOKINGS;
  const busy = running !== null;
  return (
    <div
      className={cn(
        selecting
          ? 'flex flex-wrap items-center gap-3 rounded-xl border bg-muted/50 px-4 py-2'
          : 'sr-only',
      )}
    >
      <div role="status" className="flex flex-wrap items-center gap-x-3 text-sm">
        {selecting && <span className="font-medium">{count} selected</span>}
        {tooMany && (
          <span id={limitId} className="text-destructive">
            Select up to {MAX_BULK_BOOKINGS} bookings
          </span>
        )}
      </div>
      {selecting && (
        <div role="toolbar" aria-label="Bulk actions" className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}>
            Clear selection
          </Button>
          <Button
            size="sm"
            aria-label="Confirm selected bookings"
            disabled={busy || tooMany}
            aria-describedby={tooMany ? limitId : undefined}
            onClick={onConfirm}
          >
            {running === 'confirm' ? <Spinner aria-hidden /> : <CheckIcon aria-hidden />}
            Confirm
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Cancel selected bookings"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={busy || tooMany}
            aria-describedby={tooMany ? limitId : undefined}
            onClick={onCancel}
          >
            {running === 'cancel' ? <Spinner aria-hidden /> : <XIcon aria-hidden />}
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
