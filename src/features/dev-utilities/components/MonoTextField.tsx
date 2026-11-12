import { TextField, type TextFieldProps } from '@mui/material';
import { fontFamilies } from '@/theme/tokens';

/** Multiline monospace text area for encoders, tokens and keys. */
export function MonoTextField({
  minRows = 4,
  maxRows = 16,
  ...props
}: TextFieldProps & { minRows?: number; maxRows?: number }) {
  return (
    <TextField
      multiline
      minRows={minRows}
      maxRows={maxRows}
      fullWidth
      {...props}
      slotProps={{
        ...props.slotProps,
        htmlInput: {
          spellCheck: false,
          autoCapitalize: 'off',
          autoComplete: 'off',
          style: { fontFamily: fontFamilies.mono, fontSize: 13 },
        },
      }}
    />
  );
}
