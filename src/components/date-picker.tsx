'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';

type TriggerProps = Pick<
  React.ComponentProps<'button'>,
  'id' | 'aria-invalid' | 'aria-required' | 'aria-describedby' | 'onBlur'
>;

interface DatePickerProps extends TriggerProps {
  /**
   * Name of the field. A button named by its `<label>` loses its content, so the name is built
   * here as "label, chosen day" and a screen reader hears both.
   */
  label: string;
  /** A calendar date, `YYYY-MM-DD`, or `''` for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Lets a form focus the control after a failed save. */
  ref?: React.Ref<HTMLButtonElement>;
}

// A calendar date has no zone: the picker works on dates at local noon (midnight does not exist
// on some days in some zones) and reads them back with the local getters, so the day the user
// clicked is the day that comes out.
const parseDate = (value: string) => {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const pad = (value: number) => String(value).padStart(2, '0');

const toValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** A button that shows the chosen day and opens a calendar to change it. */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  ref,
  ...triggerProps
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const text = value ? formatDate(value) : placeholder;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" type="button" ref={ref} />}
        className={cn(
          'w-full justify-start font-normal',
          !value && 'text-muted-foreground',
          className,
        )}
        aria-label={`${label}, ${text}`}
        {...triggerProps}
      >
        <CalendarIcon aria-hidden />
        {text}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? parseDate(value) : undefined}
          defaultMonth={value ? parseDate(value) : undefined}
          onSelect={(day) => {
            if (!day) return;
            onChange(toValue(day));
            setOpen(false);
          }}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
