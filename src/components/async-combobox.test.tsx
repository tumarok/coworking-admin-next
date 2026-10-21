import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { api } from '@/lib/api/client';
import { pageOf } from '@/lib/contract/common';
import { AsyncCombobox } from './async-combobox';

const fruitSchema = z.object({ id: z.string(), name: z.string() });
type Fruit = z.infer<typeof fruitSchema>;

const FRUITS: Fruit[] = [
  { id: 'f1', name: 'Apple' },
  { id: 'f2', name: 'Apricot' },
  { id: 'f3', name: 'Banana' },
  { id: 'f4', name: 'Cherry' },
];

/** Serves `FRUITS`, narrowed by `q`, and records the searches. */
const serveFruits = () => {
  const searches: string[] = [];
  server.use(
    http.get('*/bff/fruits', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? '';
      searches.push(q);
      const items = FRUITS.filter((fruit) => fruit.name.toLowerCase().includes(q.toLowerCase()));
      return HttpResponse.json({ items, total: items.length, page: 1, limit: 20 });
    }),
    http.get('*/bff/fruits/:id', ({ params }) => {
      const fruit = FRUITS.find((item) => item.id === params.id);
      return fruit
        ? HttpResponse.json(fruit)
        : HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }),
  );
  return searches;
};

const searchOptions = (term: string) =>
  queryOptions({
    queryKey: ['fruits', 'search', term],
    queryFn: ({ signal }) => api.get('fruits', pageOf(fruitSchema), { query: { q: term }, signal }),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });

const itemOptions = (id: string) =>
  queryOptions({
    queryKey: ['fruits', 'item', id],
    queryFn: ({ signal }) => api.get(`fruits/${id}`, fruitSchema, { signal }),
    meta: { silent: true },
  });

function Harness({
  initial = '',
  clearable = false,
  onChange,
}: {
  initial?: string;
  clearable?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <AsyncCombobox
        aria-label="Fruit"
        placeholder="Pick a fruit"
        value={value}
        clearable={clearable}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        unknownLabel="Unknown fruit"
        triggerLabel="Show fruits"
        clearLabel="Clear fruit"
        searchOptions={searchOptions}
        itemOptions={itemOptions}
        getValue={(fruit) => fruit.id}
        getLabel={(fruit) => fruit.name}
        emptyText="No fruit found"
      />
      <output>{value}</output>
    </>
  );
}

describe('AsyncCombobox', () => {
  it('asks nothing until it is opened, then lists the first page', async () => {
    const searches = serveFruits();
    const { user } = renderWithProviders(<Harness />);
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveAttribute(
      'placeholder',
      'Pick a fruit',
    );
    expect(searches).toEqual([]);

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));

    expect(await screen.findByRole('option', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(searches).toEqual(['']);
  });

  it('opens from its button and takes its name and state from the field around it', async () => {
    serveFruits();
    const { user } = renderWithProviders(
      <>
        <label htmlFor="fruit">Favourite fruit</label>
        <AsyncCombobox
          id="fruit"
          aria-invalid
          aria-describedby="fruit-error"
          value=""
          onChange={vi.fn()}
          unknownLabel="Unknown fruit"
          triggerLabel="Show fruits"
          searchOptions={searchOptions}
          itemOptions={itemOptions}
          getValue={(fruit) => fruit.id}
          getLabel={(fruit) => fruit.name}
        />
        <p id="fruit-error">Choose a fruit</p>
      </>,
    );
    const input = screen.getByRole('combobox', { name: 'Favourite fruit' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Choose a fruit');

    await user.click(screen.getByRole('button', { name: 'Show fruits' }));

    expect(await screen.findByRole('option', { name: 'Cherry' })).toBeInTheDocument();
  });

  it('sends the typed text to the server once typing pauses', async () => {
    const searches = serveFruits();
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await screen.findByRole('option', { name: 'Banana' });

    await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'ap');

    await waitFor(() => {
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Apple',
        'Apricot',
      ]);
    });
    // One request for the pair of keys, not one per key.
    expect(searches).toEqual(['', 'ap']);
  });

  it('chooses an option with the mouse and reports its id', async () => {
    serveFruits();
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.click(await screen.findByRole('option', { name: 'Cherry' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('f4');
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Cherry');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('works from the keyboard: type, arrow down, Enter', async () => {
    serveFruits();
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await screen.findByRole('option', { name: 'Apple' });
    await user.keyboard('ban');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('f3');
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
  });

  it('closes on Escape without choosing anything', async () => {
    serveFruits();
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await screen.findByRole('option', { name: 'Apple' });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the label of a value that comes from outside, without opening', async () => {
    serveFruits();
    renderWithProviders(<Harness initial="f3" />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
    });
  });

  it('keeps the chosen label when a later search no longer returns it', async () => {
    serveFruits();
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.click(await screen.findByRole('option', { name: 'Banana' }));
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    await user.tripleClick(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.keyboard('cher');
    await waitFor(() => {
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Cherry']);
    });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
    });
  });

  it('says so while it searches and when nothing matches', async () => {
    serveFruits();
    server.use(
      http.get('*/bff/fruits', async ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        if (q === 'zzz') {
          await delay(200);
          return HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 });
        }
        return undefined;
      }),
    );
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await screen.findByRole('option', { name: 'Apple' });

    await user.keyboard('zzz');

    expect(await screen.findByText('Searching…')).toBeInTheDocument();
    expect(await screen.findByText('No fruit found')).toBeInTheDocument();
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
  });

  it('says so when the search fails', async () => {
    server.use(
      http.get('*/bff/fruits', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 500 }),
      ),
    );
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));

    expect(await screen.findByText('Could not load the options')).toBeInTheDocument();
    expect(screen.queryByText('No fruit found')).not.toBeInTheDocument();
  });

  it('clears the choice when it is clearable', async () => {
    serveFruits();
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness initial="f1" clearable onChange={onChange} />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Apple');
    });

    await user.click(screen.getByRole('button', { name: 'Clear fruit' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('');
  });

  it('empties the box when the owner resets the value', async () => {
    serveFruits();
    function Reset() {
      const [value, setValue] = useState('f2');
      return (
        <>
          <button
            onClick={() => {
              setValue('');
            }}
          >
            reset
          </button>
          <AsyncCombobox
            aria-label="Fruit"
            value={value}
            onChange={setValue}
            unknownLabel="Unknown fruit"
            triggerLabel="Show fruits"
            searchOptions={searchOptions}
            itemOptions={itemOptions}
            getValue={(fruit) => fruit.id}
            getLabel={(fruit) => fruit.name}
          />
        </>
      );
    }
    const { user } = renderWithProviders(<Reset />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Apricot');
    });

    await user.click(screen.getByRole('button', { name: 'reset' }));

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('');
    });
  });

  it('names a value whose record is unknown and marks the box invalid', async () => {
    serveFruits();
    renderWithProviders(<Harness initial="nope" />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Unknown fruit');
    });
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toBeInvalid();
  });

  it('says "Loading…" while the record of a value is being looked up', async () => {
    serveFruits();
    server.use(
      http.get('*/bff/fruits/f3', async () => {
        await delay(200);
        return undefined;
      }),
    );
    renderWithProviders(<Harness initial="f3" />);

    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Loading…');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
    });
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toBeValid();
  });

  it('names the value as unknown when the lookup fails, and still lets the user choose', async () => {
    server.use(
      http.get('*/bff/fruits/f3', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 404 }),
      ),
    );
    serveFruits();
    server.use(
      http.get('*/bff/fruits/f3', () =>
        HttpResponse.json({ message: 'The server failed' }, { status: 404 }),
      ),
    );
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness initial="f3" onChange={onChange} />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Unknown fruit');
    });

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.click(await screen.findByRole('option', { name: 'Cherry' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('f4');
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Cherry');
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toBeValid();
  });

  it('does not look the record up by id when the user has just picked it', async () => {
    serveFruits();
    let lookups = 0;
    server.use(
      http.get('*/bff/fruits/:id', () => {
        lookups += 1;
        return undefined;
      }),
    );
    const { user } = renderWithProviders(<Harness />);

    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.click(await screen.findByRole('option', { name: 'Banana' }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
    expect(lookups).toBe(0);
  });

  it('shows "Searching…" and offers nothing to pick while typing has not been sent yet', async () => {
    serveFruits();
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await screen.findByRole('option', { name: 'Apple' });

    await user.keyboard('ban');

    expect(screen.getByText('Searching…')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('starts from the first page again when it is reopened', async () => {
    const searches = serveFruits();
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.keyboard('che');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Show fruits' }));

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(4);
    });
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
    expect(searches).toContain('che');
  });

  it('keeps the choice when the text is deleted and the box is not clearable', async () => {
    serveFruits();
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness initial="f3" onChange={onChange} />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
    });

    await user.clear(screen.getByRole('combobox', { name: 'Fruit' }));
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
    });
  });

  it('reports "nothing" when the text is deleted and the box is clearable', async () => {
    serveFruits();
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness initial="f3" clearable onChange={onChange} />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue('Banana');
    });

    await user.clear(screen.getByRole('combobox', { name: 'Fruit' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
  });

  it('gives each control the button names its owner chose', () => {
    serveFruits();
    renderWithProviders(<Harness initial="f1" clearable />);

    expect(screen.getByRole('button', { name: 'Show fruits' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show options' })).not.toBeInTheDocument();
  });
});
