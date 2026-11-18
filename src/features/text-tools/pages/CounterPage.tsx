import {
  Box,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { Panel } from '@/components';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { formatBytes } from '@/core/format/bytes';
import { formatDuration, type TextStats } from '@/core/text/stats';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { TextInput } from '../components/TextInput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_TEXT } from '../samples';

const LIMITS = [
  { value: 0, label: 'No limit' },
  { value: 160, label: 'SMS / meta description (160)' },
  { value: 280, label: 'X / Twitter post (280)' },
  { value: 500, label: '500 characters' },
  { value: 2200, label: 'Instagram caption (2,200)' },
  { value: 3000, label: 'LinkedIn post (3,000)' },
] as const;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, height: '100%' }}
    >
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="h4" component="div" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function StatsView({ s, limit }: { s: TextStats; limit: number }) {
  const n = (x: number) => x.toLocaleString();
  const over = limit > 0 && s.characters > limit;
  return (
    <Stack spacing={2} sx={{ p: 2, overflow: 'auto' }}>
      {limit > 0 && (
        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" color={over ? 'error' : 'text.secondary'}>
              {over
                ? `${n(s.characters - limit)} characters over the limit`
                : `${n(limit - s.characters)} characters left`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {n(s.characters)} / {n(limit)}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            aria-label="Character limit"
            color={over ? 'error' : 'primary'}
            value={Math.min(100, (s.characters / limit) * 100)}
            sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
          />
        </Box>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        }}
      >
        {[
          ['Words', n(s.words), `${n(s.uniqueWords)} unique`],
          ['Characters', n(s.characters), `${n(s.charactersNoSpaces)} without spaces`],
          ['Sentences', n(s.sentences)],
          ['Paragraphs', n(s.paragraphs)],
          ['Lines', n(s.lines), `${n(s.emptyLines)} empty · longest ${n(s.longestLineLength)}`],
          ['Reading time', formatDuration(s.readingSeconds), '238 words per minute'],
          ['Speaking time', formatDuration(s.speakingSeconds), '150 words per minute'],
          ['Average word', `${String(s.averageWordLength)} letters`],
        ].map(([label = '', value = '', hint]) => (
          <Tile key={label} label={label} value={value} {...(hint ? { hint } : {})} />
        ))}
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 0.5 }}>
            Encoding sizes
          </Typography>
          <Table size="small" aria-label="Encoding sizes">
            <TableBody>
              {[
                ['Grapheme clusters (what you see)', n(s.characters)],
                ['Unicode code points', n(s.codePoints)],
                ['UTF-16 code units (JavaScript length)', n(s.utf16Units)],
                [
                  'UTF-8 bytes',
                  s.utf8Bytes >= 1024
                    ? `${n(s.utf8Bytes)} (${formatBytes(s.utf8Bytes)})`
                    : n(s.utf8Bytes),
                ],
              ].map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell component="th" scope="row" sx={{ color: 'text.secondary', pl: 0 }}>
                    {k}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {v}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 0.5 }}>
            Most frequent words
          </Typography>
          {s.topWords.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No words yet.
            </Typography>
          ) : (
            <Table size="small" aria-label="Most frequent words">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 0 }}>Word</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Share</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.topWords.map((w) => (
                  <TableRow key={w.word}>
                    <TableCell sx={{ pl: 0 }}>{w.word}</TableCell>
                    <TableCell align="right">{n(w.count)}</TableCell>
                    <TableCell align="right">
                      {((w.count / Math.max(1, s.words)) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
}

export default function CounterPage() {
  const [opts, setOpts] = usePersistentOptions<{ ignoreStopWords: boolean; limit: number }>(
    'text.counter',
    {
      ignoreStopWords: true,
      limit: 0,
    },
  );
  const text = useDebouncedValue(
    useTextWorkspaceStore((s) => s.text),
    150,
  );
  const payload = useMemo(
    () => ({ text, ignoreStopWords: opts.ignoreStopWords }),
    [text, opts.ignoreStopWords],
  );
  const state = useTextOperation('stats', payload);
  return (
    <TextToolLayout
      toolId="text.counter"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Character limit"
            value={opts.limit}
            options={LIMITS}
            width={260}
            onChange={(limit) => {
              setOpts({ limit });
            }}
          />
          <SwitchOption
            label="Ignore common words in the top list"
            checked={opts.ignoreStopWords}
            onChange={(ignoreStopWords) => {
              setOpts({ ignoreStopWords });
            }}
          />
        </OptionsBar>
      }
      input={<TextInput field="text" title="Text" sample={SAMPLE_TEXT} />}
      output={
        <Panel title="Statistics" busy={state.status === 'running'}>
          <OperationStatusView state={state} emptyHint="Type or paste text on the left.">
            {(s) => <StatsView s={s} limit={opts.limit} />}
          </OperationStatusView>
        </Panel>
      }
    />
  );
}
