import { FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';
import type { ReactNode } from 'react';

/** Horizontal, wrapping container for tool options. */
export function OptionsBar({ children }: { children: ReactNode }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      useFlexGap
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
    >
      {children}
    </Stack>
  );
}

export function SelectOption<T extends string | number>({
  label,
  value,
  options,
  onChange,
  width = 150,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  width?: number;
}) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={String(value)}
      onChange={(e) => {
        const match = options.find((o) => String(o.value) === e.target.value);
        if (match) onChange(match.value);
      }}
      sx={{ width }}
    >
      {options.map((o) => (
        <MenuItem key={String(o.value)} value={String(o.value)}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function SwitchOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      sx={{ mr: 0 }}
      control={
        <Switch
          size="small"
          checked={checked}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
        />
      }
      label={label}
      slotProps={{ typography: { variant: 'body2' } }}
    />
  );
}
