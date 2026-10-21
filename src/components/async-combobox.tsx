'use client';

import { useEffect, useState } from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import type { Page } from '@/lib/contract/common';

const SEARCH_DEBOUNCE_MS = 250;

type InputProps = Pick<
  React.ComponentProps<'input'>,
  | 'id'
  | 'aria-label'
  | 'aria-invalid'
  | 'aria-required'
  | 'aria-describedby'
  | 'onBlur'
  | 'placeholder'
>;

// The query keys are type parameters because a tuple key such as `['rooms', 'x', string]` does
// not fit `UseQueryOptions` with a plain `QueryKey` (its query function takes the key back).
// The query keys are type parameters because a tuple key such as `['rooms', 'x', string]` does
// not fit `UseQueryOptions` with a plain `QueryKey` (its query function takes the key back).
interface AsyncComboboxProps<
  T,
  SearchKey extends QueryKey,
  ItemKey extends QueryKey,
> extends InputProps {
  /** The chosen id, or `''` for none. */
  value: string;
  /** `''` when the choice was cleared. */
  onChange: (value: string) => void;
  /** Options for a search text (`''` lists the first page). Keep the previous page while it loads. */
  searchOptions: (term: string) => UseQueryOptions<Page<T>, Error, Page<T>, SearchKey>;
  /** One record by id: names the choice when it is not on the page the search returned. */
  itemOptions: (id: string) => UseQueryOptions<T, Error, T, ItemKey>;
  getValue: (item: T) => string;
  getLabel: (item: T) => string;
  /** Names a `value` whose record cannot be found (an id from a stale link, a failed lookup). */
  unknownLabel: string;
  /** Accessible name of the button that opens the list; distinct per control on a page. */
  triggerLabel: string;
  /** Lets the owner clear the choice (a filter). Without it, emptying the text changes nothing. */
  clearable?: boolean;
  /** Accessible name of the clear button, when `clearable`. */
  clearLabel?: string;
  /** Shown when the search finds nothing. */
  emptyText?: string;
  className?: string;
  /** Lets a form focus the control after a failed save. */
  ref?: React.Ref<HTMLInputElement>;
}

interface Option {
  id: string;
  label: string;
}

/**
 * A drop-down that asks the server while the user types, for lists too long to load whole. The
 * options are searched with the debounced text; the chosen record keeps its label even when a later
 * search no longer returns it, and a choice that cannot be resolved is shown as `unknownLabel`
 * (and the input is marked invalid) instead of an empty box.
 */
export function AsyncCombobox<T, SearchKey extends QueryKey, ItemKey extends QueryKey>({
  value,
  onChange,
  searchOptions,
  itemOptions,
  getValue,
  getLabel,
  unknownLabel,
  triggerLabel,
  clearable = false,
  clearLabel = 'Clear',
  emptyText = 'No matches',
  className,
  ref,
  ...inputProps
}: AsyncComboboxProps<T, SearchKey, ItemKey>) {
  const [open, setOpen] = useState(false);
  // Bumped to start the inner combobox afresh: it then shows the label of the choice again.
  const [revision, setRevision] = useState(0);
  // What was typed, and the part of it the server was asked for: they differ while typing goes on.
  const [draft, setDraft] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    if (draft === term) return;
    const timer = setTimeout(() => {
      setTerm(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, term]);

  // What the user picked a moment ago is known at once; a value from outside (the URL, a saved
  // record) is looked up by id.
  const [picked, setPicked] = useState<T | null>(null);
  const pickedKnown = picked !== null && getValue(picked) === value;
  const search = useQuery({ ...searchOptions(term), enabled: open });
  const known = useQuery({ ...itemOptions(value), enabled: value !== '' && !pickedKnown });

  const toOption = (item: T): Option => ({ id: getValue(item), label: getLabel(item) });
  const record = pickedKnown ? picked : known.data;
  const label =
    value === '' ? null : record ? getLabel(record) : known.isPending ? 'Loading…' : unknownLabel;
  // The inner combobox treats a new object as a new choice and rewrites the text the user is
  // typing, so the option keeps its identity until the id or the label really changes.
  const [selected, setSelected] = useState<Option | null>(null);
  if ((selected?.id ?? '') !== value || (selected?.label ?? null) !== label) {
    setSelected(label === null ? null : { id: value, label });
  }

  // Results of an older text must not be pickable while newer text is still waiting to be sent.
  const typing = draft !== term;
  const results = typing ? [] : (search.data?.items ?? []);
  const options = results.map(toOption);
  const status = search.isError
    ? 'Could not load the options'
    : search.isFetching || typing
      ? 'Searching…'
      : null;

  return (
    <Combobox<Option>
      key={revision}
      items={options}
      filter={null}
      value={selected}
      onValueChange={(next: Option | null) => {
        // Deleting the text reports "nothing chosen"; only a clearable control takes that.
        if (next === null && !clearable) return;
        setPicked(results.find((item) => getValue(item) === next?.id) ?? null);
        onChange(next === null ? '' : next.id);
      }}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.id}
      isItemEqualToValue={(a, b) => a.id === b.id}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDraft('');
          setTerm('');
        }
      }}
      onInputValueChange={(text, { reason }) => {
        // Only typing is a search; picking an item or closing the list rewrites the box too.
        if (reason === 'input-change' || reason === 'input-clear') setDraft(text.trim());
      }}
    >
      <ComboboxInput
        ref={ref}
        showClear={clearable}
        triggerLabel={triggerLabel}
        clearLabel={clearLabel}
        className={className}
        {...inputProps}
        onBlur={(event) => {
          inputProps.onBlur?.(event);
          // The text was deleted but the choice stays (see `onValueChange`): do not leave the box
          // empty while a value is set.
          if (!clearable && value !== '' && event.currentTarget.value === '') {
            setRevision((current) => current + 1);
          }
        }}
        aria-invalid={inputProps['aria-invalid'] || known.isError || undefined}
      />
      <ComboboxContent aria-busy={search.isFetching || typing || undefined}>
        <ComboboxPrimitive.Status className="px-2.5 py-2 text-sm text-muted-foreground empty:hidden">
          {status}
        </ComboboxPrimitive.Status>
        <ComboboxEmpty>{status === null ? emptyText : null}</ComboboxEmpty>
        <ComboboxList>
          {(option: Option) => (
            <ComboboxItem key={option.id} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
