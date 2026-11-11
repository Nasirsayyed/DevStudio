import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { type EditorMarker, Panel, type RevealRequest } from '@/components';
import { ParseError } from '@/core/errors/AppError';
import { formatCount } from '@/core/format/bytes';
import type { JsonAnalysis } from '@/core/json/parse';
import { toJsonPath } from '@/core/json/path';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { fontFamilies } from '@/theme/tokens';
import { JsonToolLayout } from '../components/JsonToolLayout';
import { OperationStatusView } from '../components/StatusViews';
import { useJsonOperation } from '../hooks/useJsonOperation';
import { useJsonStudioStore } from '../store';

function ErrorContext({ text, line, column }: { text: string; line: number; column: number }) {
  const lines = text.split('\n');
  const start = Math.max(0, line - 3);
  const shown = lines.slice(start, line);
  return (
    <Box
      component="pre"
      aria-label="Error context"
      sx={{
        m: 0,
        mt: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: 'background.sunken',
        fontFamily: fontFamilies.mono,
        fontSize: 12.5,
        overflowX: 'auto',
      }}
    >
      {shown.map((l, i) => {
        const n = start + i + 1;
        return `${String(n).padStart(5)} │ ${l.length > 200 ? `${l.slice(0, 200)}…` : l}\n`;
      })}
      {`${' '.repeat(5)} │ ${' '.repeat(Math.max(0, Math.min(column - 1, 200)))}^`}
    </Box>
  );
}

const STAT_LABELS: [keyof JsonAnalysis['stats'], string][] = [
  ['depth', 'Max depth'],
  ['objects', 'Objects'],
  ['arrays', 'Arrays'],
  ['keys', 'Keys'],
  ['strings', 'Strings'],
  ['numbers', 'Numbers'],
  ['booleans', 'Booleans'],
  ['nulls', 'Nulls'],
];

export default function JsonValidatorPage() {
  const input = useJsonStudioStore((s) => s.input);
  const payload = useMemo(() => (input.length ? { text: input } : null), [input]);
  const state = useJsonOperation('analyze', payload);
  const [reveal, setReveal] = useState<RevealRequest | null>(null);
  const analysis = state.result;
  const stale = state.stale;

  const inputError = useMemo(
    () =>
      analysis?.error && !stale
        ? new ParseError(analysis.error.message, {
            line: analysis.error.line,
            column: analysis.error.column,
          })
        : null,
    [analysis, stale],
  );
  const markers = useMemo<EditorMarker[]>(
    () =>
      (analysis && !stale ? analysis.duplicates : []).map((d) => ({
        line: d.line,
        column: d.column,
        endColumn: d.column + d.key.length + 2,
        message: `Duplicate key "${d.key}" — JSON.parse keeps only the last value`,
        severity: 'warning',
      })),
    [analysis, stale],
  );

  return (
    <JsonToolLayout
      toolId="json.validator"
      sample={SAMPLE_ORDER_JSON}
      inputError={inputError}
      inputValid={analysis?.valid}
      inputMarkers={markers}
      inputReveal={reveal}
      onRun={state.run}
    >
      <Panel title="Validation result" busy={state.status === 'running'}>
        <Box sx={{ overflowY: 'auto', p: 1.5 }}>
          <OperationStatusView
            state={state}
            emptyHint="Paste, type, drop or open JSON on the left to validate it."
          >
            {(a) => (
              <Stack spacing={2}>
                {a.error ? (
                  <Alert severity="error" role="alert" sx={{ borderRadius: 2 }}>
                    <AlertTitle>Invalid JSON</AlertTitle>
                    <Typography variant="body2">{a.error.message}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Line {a.error.line}, column {a.error.column}
                    </Typography>
                    <ErrorContext text={input} line={a.error.line} column={a.error.column} />
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => {
                        if (a.error)
                          setReveal({
                            line: a.error.line,
                            column: a.error.column,
                            token: Date.now(),
                          });
                      }}
                    >
                      Go to error
                    </Button>
                  </Alert>
                ) : (
                  <Alert severity="success" role="status" sx={{ borderRadius: 2 }}>
                    <AlertTitle>Valid JSON</AlertTitle>
                    The document conforms to RFC 8259.
                    {a.nestingLimitReached ? ' (Very deep nesting: statistics are partial.)' : ''}
                  </Alert>
                )}
                {a.duplicateCount > 0 && (
                  <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                    <AlertTitle>
                      {a.duplicateCount} duplicate key{a.duplicateCount === 1 ? '' : 's'}
                    </AlertTitle>
                    Duplicate keys are legal but ambiguous: most parsers keep only the last value.
                    <List dense aria-label="Duplicate keys" sx={{ mt: 0.5 }}>
                      {a.duplicates.slice(0, 50).map((d) => (
                        <ListItemButton
                          key={`${d.line}:${d.column}`}
                          onClick={() => {
                            setReveal({ line: d.line, column: d.column, token: Date.now() });
                          }}
                          sx={{ borderRadius: 1 }}
                        >
                          <ListItemText
                            primary={`"${d.key}" in ${toJsonPath(d.path)}`}
                            secondary={`Line ${d.line}, column ${d.column}`}
                            slotProps={{
                              primary: { sx: { fontFamily: fontFamilies.mono, fontSize: 12.5 } },
                            }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Alert>
                )}
                {!a.error && (
                  <div>
                    <Typography variant="overline" color="text.secondary">
                      Statistics
                    </Typography>
                    <Grid container spacing={1} sx={{ mt: 0.5 }}>
                      {STAT_LABELS.map(([key, label]) => (
                        <Grid key={key} size={{ xs: 6, sm: 3 }}>
                          <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="h5" component="p">
                              {formatCount(a.stats[key])}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </div>
                )}
                {state.durationMs !== null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Analyzed in ${state.durationMs} ms`}
                    sx={{ alignSelf: 'flex-start' }}
                  />
                )}
              </Stack>
            )}
          </OperationStatusView>
        </Box>
      </Panel>
    </JsonToolLayout>
  );
}
