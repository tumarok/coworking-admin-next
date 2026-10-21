import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormSelect } from './form-select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('FormSelect', () => {
  it('is a combobox named by its label and shows the selected option', () => {
    render(<FormSelect label="Kind" options={OPTIONS} value="b" onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Kind' })).toHaveTextContent('Beta');
  });

  it('reports the chosen option', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FormSelect label="Kind" options={OPTIONS} value="a" onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Kind' }));
    await user.click(await screen.findByRole('option', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('shows an error under the control', () => {
    render(
      <FormSelect label="Kind" options={OPTIONS} value="a" onChange={vi.fn()} error="Pick one" />,
    );

    expect(screen.getByRole('combobox', { name: 'Kind' })).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Pick one');
  });
});
