'use client';

import { useId } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

interface Control {
  id: string;
  'aria-invalid': boolean;
  'aria-required': true | undefined;
  'aria-describedby': string | undefined;
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  /** Message under the control; also marks the control invalid. */
  error?: string | undefined;
  hint?: string;
  className?: string;
  /** The control; spread `control` on it so label, error and hint stay connected. */
  children: (control: Control) => React.ReactNode;
}

/** Label, control, hint and error of one form field, wired together for assistive technology. */
export function FormField({
  label,
  required = false,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : undefined, hint ? hintId : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <Field data-invalid={!!error} className={cn(className)}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </FieldLabel>
      {children({
        id,
        'aria-invalid': !!error,
        'aria-required': required || undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && <FieldDescription id={hintId}>{hint}</FieldDescription>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
