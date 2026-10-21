'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckIcon,
  FlagIcon,
  LogInIcon,
  UserMinusIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BOOKING_TRANSITIONS, type Booking, type BookingStatus } from '@/lib/contract/booking';
import { humanize } from '@/lib/humanize';
import { useChangeBookingStatus } from '@/features/bookings/api/booking-mutations';
import { STATUS_ACTIONS } from '@/features/bookings/constants';

const ICONS: Record<keyof typeof STATUS_ACTIONS, LucideIcon> = {
  confirmed: CheckIcon,
  checked_in: LogInIcon,
  completed: FlagIcon,
  no_show: UserMinusIcon,
  cancelled: XIcon,
};

interface BookingStatusActionsProps {
  booking: Booking;
  /**
   * Icon buttons for a table row. Their names end with `subject`, so a screen reader can tell
   * the rows apart ("Confirm: Atrium, 14 Oct 2026, 09:00–10:00").
   */
  compact?: { subject: string };
  /**
   * Called once a change has left the booking in a status with no further moves. The buttons are
   * gone by then, so the screen decides where focus goes.
   */
  onSettled?: () => void;
}

/** One button per status the booking may move to. Cancelling asks first. */
export function BookingStatusActions({ booking, compact, onSettled }: BookingStatusActionsProps) {
  const change = useChangeBookingStatus(booking.id);
  const [confirming, setConfirming] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const next = BOOKING_TRANSITIONS[booking.status].filter(
    (status): status is keyof typeof STATUS_ACTIONS => status !== 'pending',
  );

  const move = (status: BookingStatus) => {
    setCancelError(null);
    change.mutate(status, {
      onSuccess: () => {
        toast.success(`Booking ${humanize(status).toLowerCase()}`);
        setConfirming(false);
        if (BOOKING_TRANSITIONS[status].length === 0) onSettled?.();
      },
      onError: (error) => {
        // A refused cancel is explained in the dialog that asked; any other change in a toast.
        if (status === 'cancelled') setCancelError(error.message);
        else toast.error(error.message);
      },
    });
  };

  return (
    <>
      {next.map((status) => {
        const action = STATUS_ACTIONS[status];
        const Icon = ICONS[status];
        const running = change.isPending && change.variables === status;
        const name = compact ? `${action.label}: ${compact.subject}` : action.label;
        return (
          <Button
            key={status}
            variant={compact ? 'ghost' : action.variant}
            size={compact ? 'icon-sm' : 'default'}
            aria-label={compact ? name : undefined}
            title={compact ? name : undefined}
            disabled={change.isPending}
            onClick={() => {
              if (action.confirm) {
                setCancelError(null);
                setConfirming(true);
              } else {
                move(status);
              }
            }}
          >
            {running ? <Spinner aria-hidden /> : <Icon aria-hidden />}
            {!compact && action.label}
          </Button>
        );
      })}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Cancel this booking?"
        description="The room is free for other bookings again. This cannot be undone."
        confirmLabel="Cancel booking"
        destructive
        pending={change.isPending}
        error={cancelError}
        onConfirm={() => {
          move('cancelled');
        }}
      />
    </>
  );
}
