'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** How long typing must pause before the text is sent up. */
export const SEARCH_DEBOUNCE_MS = 300;

interface SearchInputProps {
  /** Search text of the owner (the URL); typing is sent up after a pause. */
  value: string;
  onSearch: (text: string) => void;
  /** Accessible name; also the placeholder. */
  label: string;
}

/**
 * Search box for a list. The draft lives here so every keystroke stays local; `onSearch` runs once
 * typing pauses. A change of `value` that did not come from this box (back button, "clear
 * filters") replaces the draft.
 */
export function SearchInput({ value, onSearch, label }: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  // The last text this box sent up: an echo of it from the owner must not overwrite newer typing.
  const [sent, setSent] = useState(value);
  const [seen, setSeen] = useState(value);
  const emit = useEffectEvent(onSearch);
  const inputRef = useRef<HTMLInputElement>(null);

  // Adjusting state while rendering, the documented way to follow a prop.
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setDraft(value);
      setSent(value);
    }
  }

  useEffect(() => {
    if (draft === sent) return;
    const timer = setTimeout(() => {
      setSent(draft);
      emit(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, sent]);

  const clear = () => {
    setDraft('');
    setSent('');
    onSearch('');
    // The button unmounts with the text: keep the keyboard user where they are.
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={label}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        // The browser's own clear control is replaced by the button below.
        className="px-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          aria-label="Clear search"
          onClick={clear}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}
