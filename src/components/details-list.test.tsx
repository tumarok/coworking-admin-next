import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailsList } from './details-list';

/** Label -> value text of the rendered list. */
const readList = () => {
  const terms = screen.getAllByRole('term').map((term) => term.textContent);
  const values = screen.getAllByRole('definition').map((value) => value.textContent);
  return Object.fromEntries(terms.map((term, index) => [term, values[index]]));
};

describe('DetailsList', () => {
  it('pairs every label with its value', () => {
    render(
      <DetailsList
        items={[
          { label: 'City', value: 'Kyiv' },
          { label: 'Rooms', value: 0 },
        ]}
      />,
    );

    expect(readList()).toEqual({ City: 'Kyiv', Rooms: '0' });
  });

  it.each([[null], [undefined], ['']])('shows a dash for %j', (value) => {
    render(<DetailsList items={[{ label: 'Company', value }]} />);

    expect(readList()).toEqual({ Company: '—' });
  });

  it('accepts elements as values', () => {
    render(<DetailsList items={[{ label: 'Status', value: <b>Active</b> }]} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
