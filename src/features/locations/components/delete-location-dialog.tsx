'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { Location } from '@/lib/contract/location';
import { useDeleteLocation } from '@/features/locations/api/location-mutations';

interface DeleteLocationDialogProps {
  /**
   * The location to delete. The owner keeps it after closing, so the title does not change while
   * the dialog fades out; `null` only before the first opening.
   */
  location: Location | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

/** Asks, deletes, and keeps the answer of the API (rooms still exist) in the dialog. */
export function DeleteLocationDialog({
  location,
  open,
  onOpenChange,
  onDeleted,
}: DeleteLocationDialogProps) {
  const mutation = useDeleteLocation();
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setError(null);
        onOpenChange(open);
      }}
      title={`Delete ${location?.name ?? 'location'}?`}
      description="The location is removed for good. It must have no rooms."
      confirmLabel="Delete"
      destructive
      pending={mutation.isPending}
      error={error}
      onConfirm={() => {
        if (!location) return;
        setError(null);
        mutation.mutate(location.id, {
          onSuccess: () => {
            toast.success('Location deleted', { description: location.name });
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
