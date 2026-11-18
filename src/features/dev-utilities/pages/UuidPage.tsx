import {
  Alert,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import { toUserMessage } from '@/core/errors/AppError';
import {
  generateUuids,
  inspectUuid,
  MAX_UUID_COUNT,
  UUID_NAMESPACES,
  type UuidVersion,
} from '@/core/generators/uuid';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { fontFamilies } from '@/theme/tokens';
import { GeneratedList } from '../components/GeneratedList';
import { NumberField } from '../components/NumberField';
import { ResultTable } from '../components/ResultRow';
import { UtilityPage } from '../components/UtilityPage';

const VERSIONS = [
  { value: 'v4', label: 'v4 — random' },
  { value: 'v7', label: 'v7 — time-ordered (recommended for DB keys)' },
  { value: 'v1', label: 'v1 — time + node' },
  { value: 'v6', label: 'v6 — reordered time' },
  { value: 'v5', label: 'v5 — name-based (SHA-1)' },
  { value: 'nil', label: 'Nil' },
  { value: 'max', label: 'Max' },
] as const;

interface Options {
  version: UuidVersion;
  count: number;
  uppercase: boolean;
  hyphens: boolean;
  namespace: string;
  name: string;
}

function generate(o: Options): { values: string[]; error: string | null } {
  try {
    const values = generateUuids(o.version, o.count, { namespace: o.namespace, name: o.name }).map(
      (u) => {
        const s = o.hyphens ? u : u.replace(/-/g, '');
        return o.uppercase ? s.toUpperCase() : s;
      },
    );
    return { values, error: null };
  } catch (e) {
    return { values: [], error: toUserMessage(e) };
  }
}

function Inspector() {
  const [value, setValue] = useState('');
  const info = value.trim() ? inspectUuid(value) : null;
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" component="h2">
          Inspect a UUID
        </Typography>
        <TextField
          size="small"
          label="UUID to inspect"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          slotProps={{ htmlInput: { style: { fontFamily: fontFamilies.mono } } }}
        />
        {info && !info.valid && <Alert severity="error">Not a valid UUID.</Alert>}
        {info?.valid && (
          <ResultTable
            ariaLabel="UUID details"
            items={[
              { label: 'Version', value: String(info.version) },
              { label: 'Variant', value: info.variant ?? '' },
              ...(info.timestamp
                ? [{ label: 'Embedded time', value: info.timestamp.toISOString() }]
                : []),
            ]}
          />
        )}
      </Stack>
    </Paper>
  );
}

export default function UuidPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('utils.uuid', {
    version: 'v4',
    count: 5,
    uppercase: false,
    hyphens: true,
    namespace: UUID_NAMESPACES.DNS,
    name: 'example.com',
  });
  const [result, setResult] = useState(() => generate(opts));
  const update = (patch: Partial<Options>) => {
    const next = { ...opts, ...patch };
    setOpts(patch);
    setResult(generate(next));
  };
  return (
    <UtilityPage toolId="utils.uuid">
      <GeneratedList
        title="UUIDs"
        values={result.values}
        error={result.error}
        filename="uuids.txt"
        onRegenerate={() => {
          setResult(generate(opts));
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <SelectOption
            label="Version"
            value={opts.version}
            options={VERSIONS}
            onChange={(version) => {
              update({ version });
            }}
            width={330}
          />
          <NumberField
            label="Count"
            value={opts.count}
            min={1}
            max={MAX_UUID_COUNT}
            onChange={(count) => {
              update({ count });
            }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={opts.uppercase}
                onChange={(e) => {
                  update({ uppercase: e.target.checked });
                }}
              />
            }
            label="Uppercase"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={opts.hyphens}
                onChange={(e) => {
                  update({ hyphens: e.target.checked });
                }}
              />
            }
            label="Hyphens"
          />
        </Stack>
        {opts.version === 'v5' && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <Stack direction="row" spacing={0.5}>
              {(Object.keys(UUID_NAMESPACES) as (keyof typeof UUID_NAMESPACES)[]).map((k) => (
                <Chip
                  key={k}
                  label={k}
                  size="small"
                  variant={opts.namespace === UUID_NAMESPACES[k] ? 'filled' : 'outlined'}
                  onClick={() => {
                    update({ namespace: UUID_NAMESPACES[k] });
                  }}
                />
              ))}
            </Stack>
            <TextField
              size="small"
              label="Namespace UUID"
              value={opts.namespace}
              onChange={(e) => {
                update({ namespace: e.target.value });
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Name"
              value={opts.name}
              onChange={(e) => {
                update({ name: e.target.value });
              }}
              sx={{ flex: 1 }}
            />
          </Stack>
        )}
      </GeneratedList>
      <Inspector />
    </UtilityPage>
  );
}
