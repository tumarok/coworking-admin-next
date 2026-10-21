'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// "Any" is an item like the others, so it is how the filter is cleared from the keyboard.
const ANY = '__any__';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  /** Accessible name of the control. */
  label: string;
  /** Text of the "no filter" choice, shown while nothing is selected. */
  anyLabel: string;
  /** The selected value, or `''` for no filter. */
  value: string;
  options: readonly FilterOption[];
  /** `''` when "any" was chosen. */
  onChange: (value: string) => void;
}

/** Drop-down filter of a list toolbar. */
export function FilterSelect({ label, anyLabel, value, options, onChange }: FilterSelectProps) {
  const items = [{ value: ANY, label: anyLabel }, ...options];
  return (
    <Select
      items={items}
      value={value || ANY}
      onValueChange={(next) => {
        onChange(next === ANY || next === null ? '' : next);
      }}
    >
      <SelectTrigger aria-label={label} className="min-w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
