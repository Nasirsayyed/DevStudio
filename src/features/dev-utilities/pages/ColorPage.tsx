import { Alert, Box, Chip, Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import {
  type Contrast,
  contrast,
  namedColor,
  parseColor,
  type Rgba,
  toCmyk,
  toHex,
  toHslString,
  toHsv,
  toRgbString,
} from '@/core/color/color';
import { toUserMessage } from '@/core/errors/AppError';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { fontFamilies } from '@/theme/tokens';
import { ResultTable } from '../components/ResultRow';
import { UtilityPage } from '../components/UtilityPage';

function useColor(text: string): { color: Rgba | null; error: string | null } {
  try {
    return { color: parseColor(text), error: null };
  } catch (e) {
    return { color: null, error: toUserMessage(e) };
  }
}

function ColorInput({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: Rgba | null;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Box
        component="input"
        type="color"
        aria-label={`${label} picker`}
        value={color ? toHex({ ...color, a: 1 }) : '#000000'}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onChange(e.target.value);
        }}
        sx={{
          width: 44,
          height: 40,
          p: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          bgcolor: 'transparent',
          cursor: 'pointer',
        }}
      />
      <TextField
        size="small"
        label={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        sx={{ flex: 1 }}
        slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: fontFamilies.mono } } }}
      />
    </Stack>
  );
}

function Rating({ label, pass }: { label: string; pass: boolean }) {
  return (
    <Chip
      size="small"
      color={pass ? 'success' : 'default'}
      variant={pass ? 'filled' : 'outlined'}
      label={`${label} ${pass ? '✓' : '✕'}`}
    />
  );
}

function ContrastRow({ title, c }: { title: string; c: Contrast }) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography variant="body2" sx={{ width: 150 }}>
        {title}
      </Typography>
      <Typography variant="h5" component="span" sx={{ width: 80 }}>
        {c.ratio.toFixed(2)}:1
      </Typography>
      <Rating label="AA" pass={c.aa} />
      <Rating label="AA large" pass={c.aaLarge} />
      <Rating label="AAA" pass={c.aaa} />
      <Rating label="AAA large" pass={c.aaaLarge} />
    </Stack>
  );
}

export default function ColorPage() {
  const [opts, setOpts] = usePersistentOptions<{ color: string; background: string }>(
    'utils.color',
    { color: '#4f46e5', background: '#ffffff' },
  );
  const fg = useColor(opts.color);
  const bg = useColor(opts.background);
  const record = useHistoryRecorder('utils.color');
  const c = fg.color;
  const opaque = c ? { ...c, a: 1 } : null;

  return (
    <UtilityPage toolId="utils.color">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5}>
              <ColorInput
                label="Color (HEX, rgb(), hsl() or name)"
                value={opts.color}
                onChange={(color) => {
                  setOpts({ color });
                }}
                color={c}
              />
              {fg.error && <Alert severity="error">{fg.error}</Alert>}
              <Box
                role="img"
                aria-label={c ? `Swatch of ${toHex(c)}` : 'Invalid color'}
                sx={{
                  height: 120,
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  backgroundImage: 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)',
                  backgroundSize: '16px 16px',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    bgcolor: c ? toRgbString(c) : 'transparent',
                  }}
                />
              </Box>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            {c && (
              <ResultTable
                ariaLabel="Color formats"
                onCopied={(item) => {
                  record(`Color ${item.label}`, opts.color, item.value);
                }}
                items={[
                  { label: 'HEX', value: toHex(c) },
                  { label: 'HEX + alpha', value: toHex(c, true) },
                  { label: 'RGB', value: toRgbString(c) },
                  { label: 'HSL', value: toHslString(c) },
                  {
                    label: 'HSV / HSB',
                    value: (({ h, s, v }) => `${String(h)}°, ${String(s)}%, ${String(v)}%`)(
                      toHsv(c),
                    ),
                  },
                  {
                    label: 'CMYK',
                    value: (({ c: cy, m, y, k }) =>
                      `${String(cy)}%, ${String(m)}%, ${String(y)}%, ${String(k)}%`)(toCmyk(c)),
                  },
                  ...(namedColor(c) ? [{ label: 'CSS name', value: namedColor(c) ?? '' }] : []),
                ]}
              />
            )}
          </Grid>
        </Grid>
      </Paper>
      {opaque && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" component="h2">
              Contrast (WCAG 2.x)
            </Typography>
            <ContrastRow title="On white" c={contrast(opaque, { r: 255, g: 255, b: 255, a: 1 })} />
            <ContrastRow title="On black" c={contrast(opaque, { r: 0, g: 0, b: 0, a: 1 })} />
            <ColorInput
              label="Background to compare"
              value={opts.background}
              onChange={(background) => {
                setOpts({ background });
              }}
              color={bg.color}
            />
            {bg.error && <Alert severity="error">{bg.error}</Alert>}
            {bg.color && (
              <>
                <ContrastRow
                  title="On this background"
                  c={contrast(opaque, { ...bg.color, a: 1 })}
                />
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: toRgbString(bg.color),
                    color: toRgbString(opaque),
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="h4" component="p" sx={{ color: 'inherit' }}>
                    Large text preview (18pt)
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'inherit' }}>
                    Normal body text preview — the quick brown fox jumps over the lazy dog.
                  </Typography>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      )}
    </UtilityPage>
  );
}
