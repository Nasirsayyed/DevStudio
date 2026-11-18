import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { DocumentDownload } from 'iconsax-reactjs';
import { useMemo, useState } from 'react';
import { useNotify } from '@/components';
import { UploadButton } from '@/components/inputs/FileDropZone';
import { SelectOption } from '@/components/workspace/OptionControls';
import {
  bytesToBase64,
  decodeBase64,
  encodeBase64,
  hexDump,
  sniffBinaryType,
} from '@/core/encoding/base64';
import { toUserMessage } from '@/core/errors/AppError';
import { formatBytes } from '@/core/format/bytes';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { downloadBytes, readFileBytes } from '@/services/files/textFiles';
import { fontFamilies } from '@/theme/tokens';
import { ResultValue } from '../components/ResultRow';
import { TextTransformCard } from '../components/TextTransformCard';
import { UtilityPage } from '../components/UtilityPage';
import { useTextTransform } from '../hooks';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
type Mode = 'encode' | 'decode';

export default function Base64Page() {
  const [opts, setOpts] = usePersistentOptions<{
    mode: Mode;
    urlSafe: boolean;
    lineLength: 0 | 64 | 76;
    dataUrl: boolean;
  }>('utils.base64', {
    mode: 'encode',
    urlSafe: false,
    lineLength: 0,
    dataUrl: false,
  });
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{
    name: string;
    size: number;
    base64: string;
    type: string;
  } | null>(null);
  const notify = useNotify();
  const record = useHistoryRecorder('utils.base64');

  const encoded = useTextTransform(input, (t) =>
    encodeBase64(t, { urlSafe: opts.urlSafe, lineLength: opts.lineLength }),
  );
  const debounced = useDebouncedValue(input, 120);
  const decode = useMemo(() => {
    if (opts.mode !== 'decode' || !debounced) return { result: { text: '' }, data: null };
    try {
      const data = decodeBase64(debounced);
      return { result: { text: data.text ?? '' }, data };
    } catch (error) {
      return { result: { error: toUserMessage(error) }, data: null };
    }
  }, [debounced, opts.mode]);
  const decodedResult = decode.result;
  const decoded = decode.data;
  const binary =
    opts.mode === 'decode' &&
    input.trim() &&
    !decodedResult.error &&
    decoded &&
    decoded.text === null
      ? decoded
      : null;
  const sniffed = binary ? sniffBinaryType(binary.bytes) : null;

  return (
    <UtilityPage toolId="utils.base64">
      <TextTransformCard
        modes={[
          { value: 'encode', label: 'Encode' },
          { value: 'decode', label: 'Decode' },
        ]}
        mode={opts.mode}
        onModeChange={(mode) => {
          setOpts({ mode });
        }}
        input={input}
        onInputChange={setInput}
        inputLabel={
          opts.mode === 'encode'
            ? 'Text to encode (UTF-8)'
            : 'Base64 to decode (standard or URL-safe)'
        }
        result={opts.mode === 'encode' ? encoded : decodedResult}
        outputLabel={opts.mode === 'encode' ? 'Base64' : 'Decoded text'}
        onCopied={() => {
          record(
            `Base64 ${opts.mode}`,
            input,
            opts.mode === 'encode' ? (encoded.text ?? '') : (decodedResult.text ?? ''),
            opts,
          );
        }}
        options={
          opts.mode === 'encode' ? (
            <>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={opts.urlSafe}
                    onChange={(e) => {
                      setOpts({ urlSafe: e.target.checked });
                    }}
                  />
                }
                label="URL-safe (- _ no padding)"
              />
              <SelectOption
                label="Line length"
                value={opts.lineLength}
                options={[
                  { value: 0, label: 'No wrapping' },
                  { value: 64, label: '64 (PEM)' },
                  { value: 76, label: '76 (MIME)' },
                ]}
                onChange={(lineLength) => {
                  setOpts({ lineLength });
                }}
              />
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Whitespace, missing padding and data: URLs are accepted.
            </Typography>
          )
        }
        outputOverride={
          binary ? (
            <Stack spacing={1}>
              <Alert
                severity="info"
                sx={{ borderRadius: 2 }}
                action={
                  <Button
                    size="small"
                    startIcon={<DocumentDownload size={16} color="currentColor" />}
                    onClick={() => {
                      downloadBytes(
                        binary.bytes,
                        `decoded.${sniffed?.extension ?? 'bin'}`,
                        sniffed?.mime,
                      );
                    }}
                  >
                    Download file
                  </Button>
                }
              >
                Binary data ({formatBytes(binary.bytes.length)})
                {sniffed ? `, looks like ${sniffed.mime}` : ''}: not valid UTF-8 text.
              </Alert>
              <Box
                component="pre"
                aria-label="Hex dump"
                sx={{
                  m: 0,
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'background.sunken',
                  fontFamily: fontFamilies.mono,
                  fontSize: 12,
                  overflowX: 'auto',
                }}
              >
                {hexDump(binary.bytes, 256)}
              </Box>
            </Stack>
          ) : undefined
        }
      />

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={2}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography variant="subtitle2" component="h2" sx={{ flex: 1 }}>
              File → Base64
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={opts.dataUrl}
                  onChange={(e) => {
                    setOpts({ dataUrl: e.target.checked });
                  }}
                />
              }
              label="As data: URL"
            />
            <UploadButton
              label="Choose file"
              rules={{ extensions: [], maxBytes: MAX_FILE_BYTES }}
              onText={() => undefined}
              onError={notify.error}
              onFile={(f) => {
                readFileBytes(f, MAX_FILE_BYTES)
                  .then((bytes) => {
                    setFile({
                      name: f.name,
                      size: f.size,
                      type: f.type || 'application/octet-stream',
                      base64: bytesToBase64(bytes),
                    });
                  })
                  .catch((error: unknown) => {
                    notify.error(toUserMessage(error));
                  });
              }}
            />
          </Stack>
          {file ? (
            <ResultValue
              label={`${file.name} (${formatBytes(file.size)})`}
              value={opts.dataUrl ? `data:${file.type};base64,${file.base64}` : file.base64}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Any file up to {formatBytes(MAX_FILE_BYTES)}. It is read locally and never uploaded.
            </Typography>
          )}
        </Stack>
      </Paper>
    </UtilityPage>
  );
}
