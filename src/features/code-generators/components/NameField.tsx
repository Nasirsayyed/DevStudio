import { TextField } from '@mui/material';

/** Small text option for names (class, namespace, package, table). */
export function NameField({
  label,
  value,
  onChange,
  width = 170,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width?: number;
  placeholder?: string;
}) {
  return (
    <TextField
      size="small"
      label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      sx={{ width }}
      slotProps={{ htmlInput: { spellCheck: false, maxLength: 120 } }}
    />
  );
}
