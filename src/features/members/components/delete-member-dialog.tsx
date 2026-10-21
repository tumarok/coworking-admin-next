'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { memberFullName, type Member } from '@/lib/contract/member';
import { useDeleteMember } from '@/features/members/api/member-mutations';

interface DeleteMemberDialogProps {
  /**
   * The member to delete. The owner keeps it after closing, so the title does not change while
   * the dialog fades out; `null` only before the first opening.
   */
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

/** Asks, deletes, and keeps the answer of the API (upcoming bookings) in the dialog. */
export function DeleteMemberDialog({
  member,
  open,
  onOpenChange,
  onDeleted,
}: DeleteMemberDialogProps) {
  const mutation = useDeleteMember();
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setError(null);
        onOpenChange(open);
      }}
      title={`Delete ${member ? memberFullName(member) : 'member'}?`}
      description="The member is removed for good. They must have no upcoming bookings."
      confirmLabel="Delete"
      destructive
      pending={mutation.isPending}
      error={error}
      onConfirm={() => {
        if (!member) return;
        setError(null);
        mutation.mutate(member.id, {
          onSuccess: () => {
            toast.success('Member removed', { description: memberFullName(member) });
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
