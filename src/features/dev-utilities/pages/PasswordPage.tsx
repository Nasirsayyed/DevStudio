import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  Paper,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Refresh2 } from 'iconsax-reactjs';
import { useState } from 'react';
import { CopyButton } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import {
  DEFAULT_PASSWORD_OPTIONS,
  entropyStrength,
  generatePassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type PasswordOptions,
  passwordPoolSize,
} from '@/core/generators/password';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { fontFamilies } from '@/theme/tokens';
import { NumberField } from '../components/NumberField';
import { StrengthMeter } from '../components/StrengthMeter';
import { UtilityPage } from '../components/UtilityPage';

type Options = PasswordOptions & { count: number };

function generate(o: Options): { values: string[]; error: string | null } {
  try {
    return { values: Array.from({ length: o.count }, () => generatePassword(o)), error: null };
  } catch (e) {
    return { values: [], error: toUserMessage(e) };
  }
}

const CLASS_LABELS: [keyof PasswordOptions, string][] = [
  ['lowercase', 'Lowercase (a–z)'],
  ['uppercase', 'Uppercase (A–Z)'],
  ['digits', 'Digits (0–9)'],
  ['symbols', 'Symbols (!@#…)'],
];

export default function PasswordPage() {
  // Settings are remembered; passwords are never stored or added to history.
  const [opts, setOpts] = usePersistentOptions<Options>('utils.password', {
    ...DEFAULT_PASSWORD_OPTIONS,
    count: 5,
  });
  const [result, setResult] = useState(() => generate(opts));
  const update = (patch: Partial<Options>) => {
    setOpts(patch);
    setResult(generate({ ...opts, ...patch }));
  };
  const strength = entropyStrength(opts.length, passwordPoolSize(opts));

  return (
    <UtilityPage toolId="utils.password">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography id="pw-length" variant="body2" sx={{ width: 60 }}>
              Length
            </Typography>
            <Slider
              aria-labelledby="pw-length"
              value={opts.length}
              min={MIN_PASSWORD_LENGTH}
              max={64}
              onChange={(_, v) => {
                update({ length: v });
              }}
              sx={{ flex: 1 }}
            />
            <NumberField
              label="Characters"
              value={opts.length}
              min={MIN_PASSWORD_LENGTH}
              max={MAX_PASSWORD_LENGTH}
              onChange={(length) => {
                update({ length });
              }}
              width={120}
            />
          </Stack>
          <FormGroup row>
            {CLASS_LABELS.map(([key, label]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={Boolean(opts[key])}
                    onChange={(e) => {
                      update({ [key]: e.target.checked });
                    }}
                  />
                }
                label={label}
              />
            ))}
          </FormGroup>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={opts.excludeAmbiguous}
                  onChange={(e) => {
                    update({ excludeAmbiguous: e.target.checked });
                  }}
                />
              }
              label="Exclude look-alikes (I l 1 O 0 …)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={opts.requireEach}
                  onChange={(e) => {
                    update({ requireEach: e.target.checked });
                  }}
                />
              }
              label="At least one of each type"
            />
            <TextField
              size="small"
              label="Never use these characters"
              value={opts.exclude}
              onChange={(e) => {
                update({ exclude: e.target.value });
              }}
              sx={{ width: 230 }}
            />
            <NumberField
              label="How many"
              value={opts.count}
              min={1}
              max={50}
              onChange={(count) => {
                update({ count });
              }}
            />
          </Stack>
          <StrengthMeter strength={strength} />
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1}>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" component="h2" sx={{ flex: 1 }}>
              Passwords
            </Typography>
            <Tooltip title="Generate new passwords">
              <IconButton
                aria-label="Generate"
                onClick={() => {
                  setResult(generate(opts));
                }}
              >
                <Refresh2 size={18} color="currentColor" />
              </IconButton>
            </Tooltip>
          </Stack>
          {result.error && (
            <Alert severity="error" role="alert">
              {result.error}
            </Alert>
          )}
          <Box
            component="ul"
            aria-label="Generated passwords"
            sx={{ listStyle: 'none', m: 0, p: 0 }}
          >
            {result.values.map((pw, i) => (
              <Stack
                key={`${String(i)}-${pw}`}
                component="li"
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', py: 0.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box
                  component="code"
                  sx={{
                    flex: 1,
                    fontFamily: fontFamilies.mono,
                    fontSize: 15,
                    wordBreak: 'break-all',
                  }}
                >
                  {pw}
                </Box>
                <CopyButton value={pw} label={`Copy password ${String(i + 1)}`} />
              </Stack>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Generated with crypto.getRandomValues (unbiased). Passwords are never stored, logged or
            added to history.
          </Typography>
        </Stack>
      </Paper>
    </UtilityPage>
  );
}
