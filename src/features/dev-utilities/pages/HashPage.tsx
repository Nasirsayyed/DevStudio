import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { useNotify } from '@/components';
import { FileDropZone, UploadButton } from '@/components/inputs/FileDropZone';
import { SelectOption } from '@/components/workspace/OptionControls';
import { toUserMessage } from '@/core/errors/AppError';
import { formatBytes } from '@/core/format/bytes';
import {
  createMultiHasher,
  digestsEqual,
  HASH_ALGORITHMS,
  type HashAlgorithm,
  type HashEncoding,
  hashText,
  WEAK_ALGORITHMS,
} from '@/core/hash/hash';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { MonoTextField } from '../components/MonoTextField';
import { ResultTable } from '../components/ResultRow';
import { UtilityPage } from '../components/UtilityPage';

const MAX_FILE_BYTES = 1024 * 1024 * 1024;
const CHUNK = 2 * 1024 * 1024;

interface Options {
  algorithms: HashAlgorithm[];
  encoding: HashEncoding;
}

interface FileState {
  name: string;
  size: number;
  progress: number;
  digests: Partial<Record<HashAlgorithm, string>> | null;
}

export default function HashPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('utils.hash', {
    algorithms: ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'],
    encoding: 'hex',
  });
  const [tab, setTab] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  // HMAC keys are secrets: component state only, never persisted.
  const [hmacKey, setHmacKey] = useState('');
  const [expected, setExpected] = useState('');
  const [file, setFile] = useState<FileState | null>(null);
  const cancelRef = useRef(false);
  const notify = useNotify();
  const record = useHistoryRecorder('utils.hash');
  const debounced = useDebouncedValue(text, 150);
  const algorithms = HASH_ALGORITHMS.filter((a) => opts.algorithms.includes(a));

  let textDigests: Partial<Record<HashAlgorithm, string>> = {};
  let error: string | null = null;
  try {
    if (algorithms.length)
      textDigests = hashText(debounced, algorithms, { hmacKey, encoding: opts.encoding });
  } catch (e) {
    error = toUserMessage(e);
  }
  const digests = tab === 'text' ? textDigests : (file?.digests ?? {});

  // Read through a function: the Cancel button flips the ref while the loop awaits.
  const isCancelled = () => cancelRef.current;
  const hashFile = async (f: File) => {
    cancelRef.current = false;
    setFile({ name: f.name, size: f.size, progress: 0, digests: null });
    try {
      const hasher = createMultiHasher(algorithms, hmacKey);
      for (let offset = 0; offset < f.size; offset += CHUNK) {
        if (isCancelled()) {
          setFile(null);
          return;
        }
        hasher.update(new Uint8Array(await f.slice(offset, offset + CHUNK).arrayBuffer()));
        setFile((s) =>
          s ? { ...s, progress: Math.min(100, ((offset + CHUNK) / f.size) * 100) } : s,
        );
        // Yield so the page stays responsive between chunks.
        await new Promise((r) => setTimeout(r, 0));
      }
      if (f.size === 0) hasher.update(new Uint8Array());
      setFile({ name: f.name, size: f.size, progress: 100, digests: hasher.digest(opts.encoding) });
    } catch (e) {
      notify.error(toUserMessage(e));
      setFile(null);
    }
  };

  const matching = expected.trim()
    ? (Object.entries(digests).find(([, v]) => v && digestsEqual(v, expected))?.[0] ?? null)
    : null;
  const toggleAlg = (a: HashAlgorithm, on: boolean) => {
    setOpts({ algorithms: on ? [...opts.algorithms, a] : opts.algorithms.filter((x) => x !== a) });
  };

  return (
    <UtilityPage toolId="utils.hash">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={2}>
          <FormGroup row aria-label="Algorithms">
            {HASH_ALGORITHMS.map((a) => (
              <FormControlLabel
                key={a}
                control={
                  <Checkbox
                    size="small"
                    checked={opts.algorithms.includes(a)}
                    onChange={(e) => {
                      toggleAlg(a, e.target.checked);
                    }}
                  />
                }
                label={a}
              />
            ))}
          </FormGroup>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="password"
              autoComplete="off"
              label="HMAC key (optional)"
              value={hmacKey}
              onChange={(e) => {
                setHmacKey(e.target.value);
              }}
              helperText={
                hmacKey ? 'Computing HMACs (Keccak excluded)' : 'Leave empty for plain hashes'
              }
              sx={{ flex: 1 }}
            />
            <SelectOption
              label="Output"
              value={opts.encoding}
              options={[
                { value: 'hex', label: 'hex (lowercase)' },
                { value: 'HEX', label: 'HEX (uppercase)' },
                { value: 'base64', label: 'Base64' },
              ]}
              onChange={(encoding) => {
                setOpts({ encoding });
              }}
              width={170}
            />
          </Stack>
          <Tabs
            value={tab}
            onChange={(_, v: 'text' | 'file') => {
              setTab(v);
            }}
            aria-label="Input type"
          >
            <Tab value="text" label="Text" />
            <Tab value="file" label="File" />
          </Tabs>
          {tab === 'text' ? (
            <MonoTextField
              label="Text to hash (UTF-8)"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
              }}
              minRows={3}
            />
          ) : (
            <FileDropZone
              rules={{ extensions: [], maxBytes: MAX_FILE_BYTES }}
              onText={() => undefined}
              onFile={(f) => void hashFile(f)}
              onError={notify.error}
              label="Drop a file to hash it"
            >
              <Stack
                spacing={1.5}
                sx={{
                  p: 2,
                  border: 1,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  alignItems: 'center',
                }}
              >
                <UploadButton
                  label="Choose file"
                  rules={{ extensions: [], maxBytes: MAX_FILE_BYTES }}
                  onText={() => undefined}
                  onFile={(f) => void hashFile(f)}
                  onError={notify.error}
                />
                <Typography variant="caption" color="text.secondary">
                  Up to {formatBytes(MAX_FILE_BYTES)}. Read in chunks, entirely in your browser.
                </Typography>
                {file && (
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body2">
                      {file.name} · {formatBytes(file.size)}
                    </Typography>
                    {file.progress < 100 && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <LinearProgress
                          variant="determinate"
                          value={file.progress}
                          sx={{ flex: 1 }}
                          aria-label="Hashing progress"
                        />
                        <Button
                          size="small"
                          onClick={() => {
                            cancelRef.current = true;
                          }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    )}
                  </Box>
                )}
              </Stack>
            </FileDropZone>
          )}
        </Stack>
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}
      {Object.keys(digests).length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={1.5}>
            <ResultTable
              ariaLabel="Digests"
              onCopied={(item) => {
                if (tab === 'text' && !hmacKey)
                  record(`${item.label} hash`, text, item.value, { algorithm: item.label });
              }}
              items={algorithms
                .filter((a) => digests[a] !== undefined)
                .map((a) => ({
                  label: hmacKey ? `HMAC-${a}` : a,
                  value: digests[a] ?? '',
                  extra: (
                    <>
                      {matching === a && <Chip size="small" color="success" label="matches" />}
                      {WEAK_ALGORITHMS.has(a) && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="warning"
                          label="not collision-resistant"
                        />
                      )}
                    </>
                  ),
                }))}
            />
            <TextField
              size="small"
              label="Compare with expected hash"
              value={expected}
              onChange={(e) => {
                setExpected(e.target.value);
              }}
            />
            {expected.trim() && (
              <Alert severity={matching ? 'success' : 'error'} role="status">
                {matching
                  ? `Matches the ${matching} digest.`
                  : 'Does not match any computed digest.'}
              </Alert>
            )}
          </Stack>
        </Paper>
      )}
    </UtilityPage>
  );
}
