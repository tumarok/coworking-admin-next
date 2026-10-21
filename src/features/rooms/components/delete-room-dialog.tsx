'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { Room } from '@/lib/contract/room';
import { useDeleteRoom } from '@/features/rooms/api/room-mutations';

interface DeleteRoomDialogProps {
  /**
   * The room to delete. The owner keeps it after closing, so the title does not change while the
   * dialog fades out; `null` only before the first opening.
   */
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

/** Asks, deletes, and keeps the answer of the API (upcoming bookings) in the dialog. */
export function DeleteRoomDialog({ room, open, onOpenChange, onDeleted }: DeleteRoomDialogProps) {
  const mutation = useDeleteRoom();
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setError(null);
        onOpenChange(open);
      }}
      title={`Delete ${room?.name ?? 'room'}?`}
      description="The room is removed for good. It must have no upcoming bookings."
      confirmLabel="Delete"
      destructive
      pending={mutation.isPending}
      error={error}
      onConfirm={() => {
        if (!room) return;
        setError(null);
        mutation.mutate(room.id, {
          onSuccess: () => {
            toast.success('Room deleted', { description: room.name });
            onOpenChange(false);
            onDeleted?.();
          },
          onError: (failure) => {
            setError(failure.message);
          },
        });
      }}
    />
  );
}
