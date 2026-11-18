import {
  Box,
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Trash } from 'iconsax-reactjs';
import { assertionLabel } from '@/core/http/assertions';
import { ASSERTION_KINDS, type Assertion, type Extraction, rowId } from '@/core/http/model';
import { fontFamilies } from '@/theme/tokens';

const mono = {
  spellCheck: false,
  autoComplete: 'off',
  style: { fontFamily: fontFamilies.mono, fontSize: 13 },
};

const NEEDS_TARGET: Record<Assertion['kind'], string | null> = {
  'status-equals': null,
  'status-in-range': null,
  'json-equals': 'JSONPath, e.g. $.id',
  'json-exists': 'JSONPath, e.g. $.items[0]',
  'json-contains': 'JSONPath, e.g. $.tags',
  'header-contains': 'Header name',
  'body-contains': null,
  'time-below': null,
};

const EXPECTED_HINT: Record<Assertion['kind'], string | null> = {
  'status-equals': '200 or 200, 201',
  'status-in-range': '200-299 or 2xx',
  'json-equals': 'JSON value, e.g. 7 or "Ada"',
  'json-exists': null,
  'json-contains': 'Text or array item',
  'header-contains': 'Text',
  'body-contains': 'Text',
  'time-below': 'Milliseconds',
};

/** Assertions on the response and values extracted into variables for the following requests. */
export function TestsEditor({
  assertions,
  extract,
  onChange,
}: {
  assertions: readonly Assertion[];
  extract: readonly Extraction[];
  onChange: (patch: { assertions?: Assertion[]; extract?: Extraction[] }) => void;
}) {
  const setA = (id: string, patch: Partial<Assertion>) => {
    onChange({ assertions: assertions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  };
  const setE = (id: string, patch: Partial<Extraction>) => {
    onChange({ extract: extract.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  };
  return (
    <Stack spacing={2}>
      <Box role="group" aria-label="Assertions">
        <Typography variant="subtitle2" component="h3">
          Assertions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Checked after every send and in the Collection Runner. Values may use {'{{variables}}'}.
        </Typography>
        {assertions.map((a, i) => {
          const n = String(i + 1);
          const target = NEEDS_TARGET[a.kind];
          const expected = EXPECTED_HINT[a.kind];
          return (
            <Stack
              key={a.id}
              direction="row"
              spacing={0.5}
              useFlexGap
              sx={{ alignItems: 'center', py: 0.25, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
            >
              <Checkbox
                size="small"
                checked={a.enabled}
                onChange={(e) => {
                  setA(a.id, { enabled: e.target.checked });
                }}
                slotProps={{ input: { 'aria-label': `Enable assertion ${n}` } }}
              />
              <TextField
                select
                size="small"
                value={a.kind}
                onChange={(e) => {
                  const kind = ASSERTION_KINDS.find((k) => k === e.target.value);
                  if (kind) setA(a.id, { kind });
                }}
                sx={{ width: 210, flexShrink: 0 }}
                slotProps={{ htmlInput: { 'aria-label': `Assertion ${n} type` } }}
              >
                {ASSERTION_KINDS.map((k) => (
                  <MenuItem key={k} value={k}>
                    {assertionLabel(k)}
                  </MenuItem>
                ))}
              </TextField>
              {target !== null && (
                <TextField
                  size="small"
                  placeholder={target}
                  value={a.target}
                  onChange={(e) => {
                    setA(a.id, { target: e.target.value });
                  }}
                  sx={{ flex: 1, minWidth: 140 }}
                  slotProps={{ htmlInput: { ...mono, 'aria-label': `Assertion ${n} target` } }}
                />
              )}
              {expected !== null && (
                <TextField
                  size="small"
                  placeholder={expected}
                  value={a.expected}
                  onChange={(e) => {
                    setA(a.id, { expected: e.target.value });
                  }}
                  sx={{ flex: 1, minWidth: 140 }}
                  slotProps={{ htmlInput: { ...mono, 'aria-label': `Assertion ${n} expected` } }}
                />
              )}
              <IconButton
                size="small"
                aria-label={`Remove assertion ${n}`}
                onClick={() => {
                  onChange({ assertions: assertions.filter((x) => x.id !== a.id) });
                }}
              >
                <Trash size={16} color="currentColor" />
              </IconButton>
            </Stack>
          );
        })}
        <Button
          size="small"
          startIcon={<Add size={16} color="currentColor" />}
          onClick={() => {
            onChange({
              assertions: [
                ...assertions,
                {
                  id: rowId(),
                  kind: assertions.length === 0 ? 'status-in-range' : 'json-exists',
                  target: '',
                  expected: assertions.length === 0 ? '2xx' : '',
                  enabled: true,
                },
              ],
            });
          }}
        >
          Add assertion
        </Button>
      </Box>

      <Box role="group" aria-label="Extract variables">
        <Typography variant="subtitle2" component="h3">
          Extract variables
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Saves values from the response as runtime variables (memory only) that later requests use
          as {'{{name}}'}.
        </Typography>
        {extract.map((e, i) => {
          const n = String(i + 1);
          return (
            <Stack
              key={e.id}
              direction="row"
              spacing={0.5}
              useFlexGap
              sx={{ alignItems: 'center', py: 0.25, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
            >
              <Checkbox
                size="small"
                checked={e.enabled}
                onChange={(ev) => {
                  setE(e.id, { enabled: ev.target.checked });
                }}
                slotProps={{ input: { 'aria-label': `Enable extraction ${n}` } }}
              />
              <TextField
                size="small"
                placeholder="Variable"
                value={e.variable}
                onChange={(ev) => {
                  setE(e.id, { variable: ev.target.value });
                }}
                sx={{ width: 180 }}
                slotProps={{ htmlInput: { ...mono, 'aria-label': `Extraction ${n} variable` } }}
              />
              <TextField
                select
                size="small"
                value={e.source}
                onChange={(ev) => {
                  const source = (['json', 'header', 'status'] as const).find(
                    (s) => s === ev.target.value,
                  );
                  if (source) setE(e.id, { source });
                }}
                sx={{ width: 140, flexShrink: 0 }}
                slotProps={{ htmlInput: { 'aria-label': `Extraction ${n} source` } }}
              >
                <MenuItem value="json">JSON body</MenuItem>
                <MenuItem value="header">Header</MenuItem>
                <MenuItem value="status">Status code</MenuItem>
              </TextField>
              {e.source !== 'status' && (
                <TextField
                  size="small"
                  placeholder={e.source === 'json' ? 'JSONPath, e.g. $.token' : 'Header name'}
                  value={e.path}
                  onChange={(ev) => {
                    setE(e.id, { path: ev.target.value });
                  }}
                  sx={{ flex: 1, minWidth: 140 }}
                  slotProps={{ htmlInput: { ...mono, 'aria-label': `Extraction ${n} path` } }}
                />
              )}
              <IconButton
                size="small"
                aria-label={`Remove extraction ${n}`}
                onClick={() => {
                  onChange({ extract: extract.filter((x) => x.id !== e.id) });
                }}
              >
                <Trash size={16} color="currentColor" />
              </IconButton>
            </Stack>
          );
        })}
        <Button
          size="small"
          startIcon={<Add size={16} color="currentColor" />}
          onClick={() => {
            onChange({
              extract: [
                ...extract,
                { id: rowId(), variable: '', source: 'json', path: '$.', enabled: true },
              ],
            });
          }}
        >
          Add extraction
        </Button>
      </Box>
    </Stack>
  );
}
