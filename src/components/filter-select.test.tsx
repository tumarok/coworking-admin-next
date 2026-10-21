import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './filter-select';

const OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const setup = (value = '') => {
  const onChange = vi.fn();
  render(
    <FilterSelect
      label="Status"
      anyLabel="Any status"
      value={value}
      options={OPTIONS}
      onChange={onChange}
    />,
  );
  return { onChange, user: userEvent.setup() };
};

describe('FilterSelect', () => {
  it('shows the "any" text while nothing is selected', () => {
    setup();

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Any status');
  });

  it('shows the selected option', () => {
    setup('inactive');

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Inactive');
  });

  it('reports the chosen value', async () => {
    const { user, onChange } = setup();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Active' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('active');
  });

  it('reports an empty value when "any" is chosen again', async () => {
    const { user, onChange } = setup('active');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Any status' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
  });
});
