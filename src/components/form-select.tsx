'use client';

import { FormField } from '@/components/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormSelectProps {
  label: string;
  required?: boolean;
  error?: string | undefined;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Lets the form focus the control after a failed save. */
  ref?: React.Ref<HTMLButtonElement>;
  className?: string;
}

/** A labelled drop-down for a form field. */
export function FormSelect({
  label,
  required,
  error,
  options,
  value,
  onChange,
  onBlur,
  ref,
  className,
}: FormSelectProps) {
  return (
    <FormField label={label} required={required ?? false} error={error} className={className ?? ''}>
      {(control) => (
        <Select
          items={options}
          value={value}
          onValueChange={(next) => {
            if (next !== null) onChange(next);
          }}
        >
          <SelectTrigger {...control} ref={ref} onBlur={onBlur} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}
