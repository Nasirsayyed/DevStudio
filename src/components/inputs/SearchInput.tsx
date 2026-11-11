import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import { CloseCircle, SearchNormal1 } from 'iconsax-reactjs';
import { type Ref, useEffect, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface SearchInputProps extends Omit<
  TextFieldProps,
  'value' | 'onChange' | 'defaultValue' | 'variant'
> {
  value: string;
  /** Called after the user stops typing for `debounceMs` (0 = immediately). */
  onChange: (value: string) => void;
  debounceMs?: number;
  inputRef?: Ref<HTMLInputElement>;
  /** Accessible label; also used as placeholder when none is given. */
  label?: string;
}

export function SearchInput({
  value,
  onChange,
  debounceMs = 150,
  label = 'Search',
  placeholder,
  inputRef,
  ...rest
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, debounceMs);

  // Keep local draft in sync when the parent resets the value.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    // With debounceMs = 0 changes are emitted synchronously in onChange below.
    // Only emit once the debounced value has caught up with the draft, so a
    // stale timer can never revert newer input.
    if (debounceMs === 0 || debounced !== draft || debounced === value) return;
    onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced draft
  }, [debounced]);

  return (
    <TextField
      {...rest}
      size={rest.size ?? 'small'}
      value={draft}
      placeholder={placeholder ?? label}
      onChange={(e) => {
        setDraft(e.target.value);
        if (debounceMs === 0) onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && draft) {
          e.stopPropagation();
          setDraft('');
          onChange('');
        }
        rest.onKeyDown?.(e);
      }}
      slotProps={{
        htmlInput: { 'aria-label': label, type: 'search' },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchNormal1 size={18} color="currentColor" />
            </InputAdornment>
          ),
          endAdornment: draft ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="Clear search"
                onClick={() => {
                  setDraft('');
                  onChange('');
                }}
                edge="end"
              >
                <CloseCircle size={16} color="currentColor" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      inputRef={inputRef}
    />
  );
}
