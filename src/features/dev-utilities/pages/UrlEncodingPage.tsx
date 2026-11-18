import {
  Alert,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { SelectOption } from '@/components/workspace/OptionControls';
import { decodeUrl, encodeUrl, parseUrl, type UrlEncodeMode } from '@/core/encoding/url';
import { toUserMessage } from '@/core/errors/AppError';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { fontFamilies } from '@/theme/tokens';
import { ResultTable } from '../components/ResultRow';
import { TextTransformCard } from '../components/TextTransformCard';
import { UtilityPage } from '../components/UtilityPage';
import { useTextTransform } from '../hooks';

type Mode = 'encode' | 'decode';

function UrlParser() {
  const [url, setUrl] = useState(
    'https://api.example.com:8443/v1/search?q=hello%20world&tag=a&tag=b#results',
  );
  let parsed: ReturnType<typeof parseUrl> | null = null;
  let error: string | null = null;
  try {
    parsed = url.trim() ? parseUrl(url) : null;
  } catch (e) {
    error = toUserMessage(e);
  }
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" component="h2">
          URL parser
        </Typography>
        <TextField
          label="URL to parse"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
          }}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: fontFamilies.mono } } }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        {parsed && (
          <>
            <ResultTable
              ariaLabel="URL components"
              items={[
                { label: 'Protocol', value: parsed.protocol },
                { label: 'Host name', value: parsed.hostname },
                { label: 'Port', value: parsed.port || '(default)' },
                { label: 'Path', value: parsed.pathname },
                { label: 'Query string', value: parsed.search || '(none)' },
                { label: 'Fragment', value: parsed.hash || '(none)' },
                { label: 'Origin', value: parsed.origin },
                ...(parsed.username
                  ? [
                      {
                        label: 'User name',
                        value: parsed.username,
                        extra: parsed.hasPassword ? (
                          <Chip size="small" color="warning" label="contains a password" />
                        ) : undefined,
                      },
                    ]
                  : []),
              ]}
            />
            {parsed.params.length > 0 && (
              <Table size="small" aria-label="Query parameters">
                <TableHead>
                  <TableRow>
                    <TableCell>Parameter</TableCell>
                    <TableCell>Decoded value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsed.params.map((p, i) => (
                    <TableRow key={`${p.key}-${String(i)}`}>
                      <TableCell sx={{ fontFamily: fontFamilies.mono }}>{p.key}</TableCell>
                      <TableCell sx={{ fontFamily: fontFamilies.mono, wordBreak: 'break-all' }}>
                        {p.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export default function UrlEncodingPage() {
  const [opts, setOpts] = usePersistentOptions<{
    mode: Mode;
    encodeMode: UrlEncodeMode;
    plusAsSpace: boolean;
  }>('utils.url-encoding', { mode: 'encode', encodeMode: 'component', plusAsSpace: true });
  const [input, setInput] = useState('');
  const record = useHistoryRecorder('utils.url-encoding');
  const result = useTextTransform(input, (t) =>
    opts.mode === 'encode' ? encodeUrl(t, opts.encodeMode) : decodeUrl(t, opts.plusAsSpace),
  );
  return (
    <UtilityPage toolId="utils.url-encoding">
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
        inputLabel={opts.mode === 'encode' ? 'Text to encode' : 'Percent-encoded text'}
        result={result}
        outputLabel={opts.mode === 'encode' ? 'Encoded' : 'Decoded'}
        onCopied={() => {
          record(`URL ${opts.mode}`, input, result.text ?? '', opts);
        }}
        options={
          opts.mode === 'encode' ? (
            <SelectOption
              label="Encoding"
              value={opts.encodeMode}
              options={[
                { value: 'component', label: 'Component (query value, path segment)' },
                { value: 'uri', label: 'Full URL (keep :/?#&=)' },
                { value: 'form', label: 'Form (spaces as +)' },
              ]}
              onChange={(encodeMode) => {
                setOpts({ encodeMode });
              }}
              width={300}
            />
          ) : (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={opts.plusAsSpace}
                  onChange={(e) => {
                    setOpts({ plusAsSpace: e.target.checked });
                  }}
                />
              }
              label="Treat + as space (form data)"
            />
          )
        }
      />
      <UrlParser />
    </UtilityPage>
  );
}
