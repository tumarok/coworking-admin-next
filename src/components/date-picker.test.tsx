import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormField } from '@/components/form-field';
import { pickDate } from '@/test/pick-date';
import { DatePicker } from './date-picker';

function Controlled({
  initial = '',
  onChange,
}: {
  initial?: string;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DatePicker
      label="Date"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('DatePicker', () => {
  it('names the button after the field and the chosen day, also inside a form field', () => {
    render(
      <FormField label="Date" required>
        {(control) => (
          <DatePicker {...control} label="Date" value="2027-06-15" onChange={vi.fn()} />
        )}
      </FormField>,
    );

    expect(screen.getByRole('button', { name: 'Date, 15 Jun 2027' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date/)).toBe(screen.getByRole('button'));
  });

  it('asks for a date while there is none', () => {
    render(<DatePicker label="Date" value="" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^Date/ })).toHaveTextContent('Pick a date');
  });

  it('shows the chosen day the way the rest of the app prints dates', () => {
    render(<DatePicker label="Date" value="2027-06-15" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^Date/ })).toHaveTextContent('15 Jun 2027');
  });

  it('opens on the month of the chosen day, with that day selected', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Date" value="2027-06-15" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^Date/ }));

    expect(await screen.findByRole('grid', { name: 'June 2027' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { selected: true })).toHaveTextContent('15');
  });

  it('reports the clicked day as a calendar date and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2027-06-15" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /^Date/ }));
    await user.click(await screen.findByRole('button', { name: /June 3rd, 2027/ }));

    expect(onChange).toHaveBeenCalledWith('2027-06-03');
    expect(screen.getByRole('button', { name: /^Date/ })).toHaveTextContent('3 Jun 2027');
    await waitFor(() => {
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  it('can be walked to another month and year', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2027-11-20" onChange={onChange} />);

    await pickDate(user, screen.getByRole('button', { name: /^Date/ }), '2028-02-29');

    expect(onChange).toHaveBeenCalledWith('2028-02-29');
  });
});
