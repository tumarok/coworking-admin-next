'use client';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MultiSelectProps extends Pick<
  React.ComponentProps<'button'>,
  'id' | 'aria-label' | 'aria-invalid' | 'aria-required' | 'aria-describedby' | 'onBlur'
> {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Shown while nothing is selected. */
  placeholder?: string;
  /** Lets a form focus the control after a failed save. */
  ref?: React.Ref<HTMLButtonElement>;
}

/** A drop-down where any number of options can be ticked; the choice is shown as badges. */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'None',
  ref,
  ...triggerProps
}: MultiSelectProps) {
  const labels = new Map(options.map((option) => [option.value, option.label]));
  // Ticking order is not meaningful: the value always follows the order of the options.
  const rank = (item: string) => {
    const index = options.findIndex((option) => option.value === item);
    return index === -1 ? options.length : index;
  };
  return (
    <Select
      multiple
      items={options}
      value={[...value]}
      onValueChange={(next) => {
        onChange(next.toSorted((a, b) => rank(a) - rank(b)));
      }}
    >
      <SelectTrigger
        ref={ref}
        {...triggerProps}
        className="w-full py-1 data-[size=default]:h-auto data-[size=default]:min-h-8"
      >
        <SelectValue>
          {(selected: string[]) =>
            selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {selected.map((item) => (
                  <Badge key={item} variant="secondary">
                    {labels.get(item) ?? item}
                  </Badge>
                ))}
              </span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
