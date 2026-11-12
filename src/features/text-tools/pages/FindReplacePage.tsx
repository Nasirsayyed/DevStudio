import { Alert, Box, Button, Chip, Stack, Tab, Tabs, TextField } from '@mui/material';
import { ArrowLeft } from 'iconsax-reactjs';
import { useMemo, useState } from 'react';
import { CodeEditor, CopyButton, EmptyState, Panel, useNotify } from '@/components';
import { DataGrid } from '@/components/data-display/DataGrid';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { OptionsBar, SwitchOption } from '@/components/workspace/OptionControls';
import { ValidationError, toUserMessage } from '@/core/errors/AppError';
import type { FindMatch } from '@/core/text/findReplace';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { REGEX_TIMEOUT_MS } from '@/services/workers/textTasks';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { fontFamilies } from '@/theme/tokens';
import { TextInput } from '../components/TextInput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_TEXT } from '../samples';

interface Options {
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  multiline: boolean;
  dotAll: boolean;
  interpretEscapes: boolean;
}

const MAX_MARKERS = 500;

export default function FindReplacePage() {
  const [opts, setOpts] = usePersistentOptions<Options>('text.find-replace', {
    regex: false,
    caseSensitive: false,
    wholeWord: false,
    multiline: true,
    dotAll: false,
    interpretEscapes: false,
  });
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [tab, setTab] = useState(0);
  const text = useTextWorkspaceStore((s) => s.text);
  const set = useTextWorkspaceStore((s) => s.set);
  const notify = useNotify();
  const record = useHistoryRecorder('text.find-replace');
  const q = useDebouncedValue(query, 200);
  const r = useDebouncedValue(replacement, 200);

  const payload = useMemo(
    () => (q && text ? { text, options: { ...opts, query: q, replacement: r } } : null),
    [text, q, r, opts],
  );
  const state = useTextOperation('replace', payload, {
    preferWorker: opts.regex,
    timeoutMs: REGEX_TIMEOUT_MS,
  });
  const result = state.status === 'success' ? state.result : undefined;
  const queryError =
    state.status === 'error' && state.error instanceof ValidationError ? state.error.message : null;
  const timeout = state.status === 'error' && state.error?.code === 'TIMEOUT';

  const markers = useMemo(
    () =>
      (result?.matches ?? []).slice(0, MAX_MARKERS).map((m) => ({
        line: m.line,
        column: m.column,
        endLine: m.line,
        endColumn: m.column + Math.max(1, m.text.length),
        message: `Match: ${m.text}`,
        severity: 'info' as const,
      })),
    [result],
  );

  const onExported = () => {
    if (result)
      record('Find and replace', text, result.output, { ...opts, query: q, replacement: r });
  };

  return (
    <TextToolLayout
      toolId="text.find-replace"
      toolbar={
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label={opts.regex ? 'Find (regular expression)' : 'Find'}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              error={Boolean(queryError)}
              helperText={
                queryError ??
                (opts.regex ? 'JavaScript syntax with the u flag, e.g. (\\d{4})-(\\d{2})' : ' ')
              }
              sx={{ flex: 1 }}
              slotProps={{
                htmlInput: { spellCheck: false, style: { fontFamily: fontFamilies.mono } },
              }}
            />
            <TextField
              size="small"
              label="Replace with"
              value={replacement}
              onChange={(e) => {
                setReplacement(e.target.value);
              }}
              helperText={opts.regex ? '$1, $<name>, $& insert captured text' : ' '}
              sx={{ flex: 1 }}
              slotProps={{
                htmlInput: { spellCheck: false, style: { fontFamily: fontFamilies.mono } },
              }}
            />
          </Stack>
          <OptionsBar>
            <SwitchOption
              label="Regular expression"
              checked={opts.regex}
              onChange={(regex) => {
                setOpts({ regex });
              }}
            />
            <SwitchOption
              label="Match case"
              checked={opts.caseSensitive}
              onChange={(caseSensitive) => {
                setOpts({ caseSensitive });
              }}
            />
            <SwitchOption
              label="Whole words"
              checked={opts.wholeWord}
              onChange={(wholeWord) => {
                setOpts({ wholeWord });
              }}
            />
            {opts.regex && (
              <>
                <SwitchOption
                  label="^ $ per line"
                  checked={opts.multiline}
                  onChange={(multiline) => {
                    setOpts({ multiline });
                  }}
                />
                <SwitchOption
                  label=". matches newlines"
                  checked={opts.dotAll}
                  onChange={(dotAll) => {
                    setOpts({ dotAll });
                  }}
                />
              </>
            )}
            <SwitchOption
              label="\n \t in replacement"
              checked={opts.interpretEscapes}
              onChange={(interpretEscapes) => {
                setOpts({ interpretEscapes });
              }}
            />
          </OptionsBar>
        </Stack>
      }
      input={<TextInput field="text" title="Text" sample={SAMPLE_TEXT} markers={markers} />}
      output={
        <Panel
          title="Results"
          busy={state.status === 'running'}
          meta={
            result ? (
              <Chip
                size="small"
                color={result.total ? 'primary' : 'default'}
                variant="outlined"
                label={`${result.total.toLocaleString()} ${result.total === 1 ? 'match' : 'matches'}`}
              />
            ) : undefined
          }
          actions={
            result && tab === 1 ? (
              <>
                <Button
                  size="small"
                  startIcon={<ArrowLeft size={16} color="currentColor" />}
                  disabled={result.replacements === 0}
                  onClick={() => {
                    set({ text: result.output });
                    onExported();
                    notify.success(
                      `Replaced ${result.replacements.toLocaleString()} occurrences in the text.`,
                    );
                  }}
                >
                  Apply to text
                </Button>
                <CopyButton label="Copy result" value={result.output} onCopied={onExported} />
                <DownloadButton
                  content={result.output}
                  filename="replaced.txt"
                  label="Download result"
                  onDownloaded={onExported}
                />
              </>
            ) : undefined
          }
        >
          <Tabs
            value={tab}
            onChange={(_, v: number) => {
              setTab(v);
            }}
            sx={{ px: 1.5, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Matches" sx={{ minHeight: 40 }} />
            <Tab label="Replaced text" sx={{ minHeight: 40 }} />
          </Tabs>
          {timeout ? (
            <Alert
              severity="error"
              variant="outlined"
              role="alert"
              sx={{ m: 1.5, borderRadius: 2 }}
            >
              The regular expression took longer than {REGEX_TIMEOUT_MS / 1000} s and was stopped.
              It probably backtracks catastrophically (for example nested quantifiers like (a+)+).
              Try a more specific pattern.
            </Alert>
          ) : state.status === 'error' && !queryError ? (
            <Alert
              severity="error"
              variant="outlined"
              role="alert"
              sx={{ m: 1.5, borderRadius: 2 }}
            >
              {toUserMessage(state.error)}
            </Alert>
          ) : !result ? (
            <EmptyState
              dense
              title={text ? 'Type something to find' : 'No text yet'}
              description={
                text
                  ? 'Matches are listed here with their line and column.'
                  : 'Paste, type or open text on the left.'
              }
            />
          ) : tab === 0 ? (
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {result.truncated && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Showing the first {result.matches.length.toLocaleString()} of{' '}
                  {result.total.toLocaleString()} matches.
                </Alert>
              )}
              <DataGrid<FindMatch>
                ariaLabel="Matches"
                rows={result.matches}
                rowKey={(m) => String(m.index)}
                height="100%"
                emptyMessage="No matches."
                columns={[
                  { id: 'line', header: 'Line', width: 80, getValue: (m) => m.line },
                  { id: 'col', header: 'Col', width: 70, getValue: (m) => m.column },
                  {
                    id: 'match',
                    header: 'Match',
                    mono: true,
                    getValue: (m) => m.text,
                    render: (m) => (
                      <Box
                        component="mark"
                        sx={{
                          bgcolor: 'warning.light',
                          color: 'common.black',
                          px: 0.25,
                          borderRadius: 0.5,
                          whiteSpace: 'pre',
                        }}
                      >
                        {m.text || '∅'}
                      </Box>
                    ),
                  },
                  {
                    id: 'context',
                    header: 'Context',
                    mono: true,
                    sortable: false,
                    getValue: (m) => `${m.before}${m.text}${m.after}`,
                    render: (m) => (
                      <Box component="span" sx={{ whiteSpace: 'pre', color: 'text.secondary' }}>
                        {m.before}
                        <Box component="strong" sx={{ color: 'text.primary' }}>
                          {m.text}
                        </Box>
                        {m.after}
                      </Box>
                    ),
                  },
                ]}
              />
            </Box>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <CodeEditor
                value={result.output}
                readOnly
                ariaLabel="Replaced text"
                language="plaintext"
              />
            </Box>
          )}
        </Panel>
      }
    />
  );
}
