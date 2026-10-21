'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ROUTES } from '@/config/routes';
import type { BulkBookingAction } from '@/lib/contract/booking';
import { BULK_DONE } from '@/features/bookings/constants';

/** A booking the API refused to change, named the way the list names it, and why. */
export interface BulkFailure {
  id: string;
  /** "Room, 12 Oct 2026, 09:00–10:00"; the id when the booking is not known any more. */
  subject: string;
  reason: string;
  /** The booking does not exist any more, so it was taken off the selection. */
  gone: boolean;
}

interface BulkFailedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: BulkBookingAction;
  failures: readonly BulkFailure[];
  /** Where focus goes once the dialog has closed; see `ConfirmDialog`. */
  finalFocus?: React.ComponentProps<typeof DialogContent>['finalFocus'];
}

/** What became of the selection, said the way it is: gone bookings are off it, the rest stay. */
const selectionNote = (failures: readonly BulkFailure[]) => {
  const gone = failures.filter((failure) => failure.gone).length;
  if (gone === 0) return 'They are still selected, so you can look at them or try again.';
  if (gone === failures.length)
    return 'They no longer exist, so they were taken off the selection.';
  return 'Bookings that no longer exist were taken off the selection; the others are still selected.';
};

/**
 * The bookings a bulk action left as they were. The links open in a new tab, so the list, and the
 * selection that kept these bookings, stay where they are.
 */
export function BulkFailedDialog({
  open,
  onOpenChange,
  action,
  failures,
  finalFocus,
}: BulkFailedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[34rem]" showCloseButton={false} finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Some bookings were not {BULK_DONE[action]}</DialogTitle>
          <DialogDescription>{selectionNote(failures)}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {failures.map((failure) => (
            <li key={failure.id} className="flex flex-col gap-0.5">
              <Link
                href={ROUTES.booking(failure.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-3 hover:underline"
              >
                {failure.subject} <span className="sr-only">(opens in a new tab)</span>
              </Link>
              <span className="text-xs text-muted-foreground">{failure.reason}</span>
            </li>
          ))}
        </ul>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
