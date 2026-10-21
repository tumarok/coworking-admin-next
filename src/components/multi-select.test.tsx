import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelect } from './multi-select';

const OPTIONS = [
  { value: 'projector', label: 'Projector' },
  { value: 'whiteboard', label: 'Whiteboard' },
  { value: 'phone', label: 'Phone' },
];

function Harness({
  initial = [],
  onChange,
}: {
  initial?: string[];
  onChange?: (value: string[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MultiSelect
      aria-label="Amenities"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('MultiSelect', () => {
  it('shows the placeholder while nothing is selected', () => {
    render(<Harness />);

    expect(screen.getByRole('combobox', { name: 'Amenities' })).toHaveTextContent('None');
  });

  it('shows the selection as badges, labelled like the options', () => {
    render(<Harness initial={['phone', 'projector']} />);

    const trigger = screen.getByRole('combobox', { name: 'Amenities' });
    expect(within(trigger).getByText('Phone')).toBeInTheDocument();
    expect(within(trigger).getByText('Projector')).toBeInTheDocument();
    expect(trigger).not.toHaveTextContent('None');
  });

  it('ticks and unticks options without closing the list', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Amenities' }));
    await user.click(await screen.findByRole('option', { name: 'Whiteboard' }));
    await user.click(screen.getByRole('option', { name: 'Projector' }));

    // Ticked in the order whiteboard, projector; reported in the order of the options.
    expect(onChange).toHaveBeenLastCalledWith(['projector', 'whiteboard']);
    expect(screen.getByRole('option', { name: 'Whiteboard' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: 'Phone' })).toHaveAttribute('aria-selected', 'false');

    await user.click(screen.getByRole('option', { name: 'Whiteboard' }));

    expect(onChange).toHaveBeenLastCalledWith(['projector']);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('keeps the order of the options when a value it does not know is among the selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={['sauna', 'phone']} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Amenities' }));
    await user.click(await screen.findByRole('option', { name: 'Projector' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['projector', 'phone', 'sauna']);
  });

  it('works from the keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    screen.getByRole('combobox', { name: 'Amenities' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    // The list opens on the first option; one step down is the second.
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['whiteboard']);
    expect(screen.getByRole('option', { name: 'Whiteboard' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: 'Projector' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('takes its name and state from the field around it', () => {
    render(
      <>
        <label htmlFor="amenities">Extras</label>
        <MultiSelect
          id="amenities"
          aria-invalid
          aria-describedby="amenities-error"
          options={OPTIONS}
          value={[]}
          onChange={vi.fn()}
        />
        <p id="amenities-error">Pick something</p>
      </>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Extras' });
    expect(trigger).toBeInvalid();
    expect(trigger).toHaveAccessibleDescription('Pick something');
  });

  it('falls back to the raw value for an option it does not know', () => {
    render(
      <MultiSelect aria-label="Amenities" options={OPTIONS} value={['sauna']} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('combobox', { name: 'Amenities' })).toHaveTextContent('sauna');
  });
});
