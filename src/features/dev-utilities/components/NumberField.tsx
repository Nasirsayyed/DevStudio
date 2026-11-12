import { TextField } from '@mui/material';
import { useState } from 'react';

/**
 * Integer input clamped to [min, max]. While the user edits, the raw text is kept (so the field
 * can be cleared and retyped); valid values are committed immediately, and the text snaps back
 * to the committed value on blur.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  width = 110,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  width?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftNumber = draft === null || draft.trim() === '' ? NaN : Number(draft);
  const invalid =
    draft !== null && !(Number.isInteger(draftNumber) && draftNumber >= min && draftNumber <= max);
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={draft ?? String(value)}
      error={invalid}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = text.trim() === '' ? NaN : Number(text);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
      }}
      onBlur={() => {
        setDraft(null);
      }}
      slotProps={{ htmlInput: { min, max, step: 1 } }}
      sx={{ width }}
    />
  );
}
