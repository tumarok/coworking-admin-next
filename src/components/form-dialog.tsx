'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** A save is running: Escape and outside clicks are ignored so the dialog cannot be abandoned. */
  pending?: boolean;
  children: React.ReactNode;
}

/**
 * Dialog around a form. The form is its child and owns its state, so closing the dialog drops the
 * state and the next opening starts clean.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  pending = false,
  children,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Message of a failed save that belongs to no single field. */
export function FormError({
  id,
  ref,
  children,
}: {
  id?: string;
  /** For moving the focus here after a failed save that no field explains. */
  ref?: React.Ref<HTMLParagraphElement>;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </p>
  );
}

/** Cancel and submit buttons; put it inside the `<form>`. */
export function FormDialogFooter({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending && <Spinner aria-hidden />}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}
