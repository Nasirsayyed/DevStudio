import {
  Alert,
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { type EditorMarker, Panel, type RevealRequest } from '@/components';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { OptionsBar } from '@/components/workspace/OptionControls';
import { DIALECTS } from '@/core/sql/dialects';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { DialectSelect } from '../components/DialectSelect';
import { SqlInput } from '../components/SqlInput';
import { SqlLayout } from '../components/SqlLayout';
import { useSqlOperation } from '../hooks';
import { SAMPLE_QUERY } from '../samples';

const COLOR = { error: 'error', warning: 'warning', info: 'info' } as const;

export default function SqlValidatorPage() {
  const raw = useSqlWorkspaceStore((s) => s.sql);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const text = useDebouncedValue(raw, 300);
  const payload = useMemo(() => (text.trim() ? { text, dialect } : null), [text, dialect]);
  const state = useSqlOperation('validate', payload);
  const result = state.status === 'success' ? state.result : undefined;
  const [reveal, setReveal] = useState<RevealRequest | null>(null);
  const markers = useMemo<EditorMarker[]>(
    () =>
      (result?.issues ?? []).map((i) => ({
        line: i.line,
        column: i.column,
        message: i.message,
        severity: i.severity,
      })),
    [result],
  );

  return (
    <SqlLayout
      toolId="sql.validator"
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <Typography variant="body2" color="text.secondary">
            Each statement is parsed with the {DIALECTS[dialect].label} grammar. Some vendor
            extensions are not supported and are reported as errors.
          </Typography>
        </OptionsBar>
      }
      input={
        <SqlInput
          field="sql"
          title="SQL input"
          sample={SAMPLE_QUERY}
          saved
          markers={markers}
          reveal={reveal}
          valid={result?.valid === true}
          onRun={state.run}
        />
      }
      output={
        <Panel
          title="Result"
          busy={state.status === 'running'}
          meta={
            result ? (
              <Chip
                size="small"
                color={result.valid ? 'success' : 'error'}
                label={
                  result.valid
                    ? 'Valid'
                    : `${String(result.issues.filter((i) => i.severity === 'error').length)} error(s)`
                }
                sx={{ height: 20, fontSize: 11 }}
              />
            ) : undefined
          }
        >
          <OperationStatusView state={state} emptyHint="Paste, type, drop or open SQL on the left.">
            {(r) => (
              <Stack spacing={2} sx={{ p: 2, overflow: 'auto' }}>
                {r.valid && r.issues.length === 0 && (
                  <Alert severity="success">
                    {r.statements.length} {r.statements.length === 1 ? 'statement' : 'statements'}{' '}
                    parsed without problems.
                  </Alert>
                )}
                {r.issues.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" component="h2">
                      Problems
                    </Typography>
                    <List dense aria-label="Problems">
                      {r.issues.map((i) => (
                        <ListItemButton
                          key={`${String(i.line)}:${String(i.column)}:${i.message}`}
                          onClick={() => {
                            setReveal({ line: i.line, column: i.column, token: Date.now() });
                          }}
                        >
                          <Chip
                            size="small"
                            color={COLOR[i.severity]}
                            variant="outlined"
                            label={i.severity}
                            sx={{ mr: 1, minWidth: 64 }}
                          />
                          <ListItemText
                            primary={i.message}
                            secondary={`Line ${String(i.line)}, column ${String(i.column)}`}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Box>
                )}
                {r.statements.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" component="h2">
                      Statements
                    </Typography>
                    <Table size="small" aria-label="Statements">
                      <TableHead>
                        <TableRow>
                          <TableCell>Line</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Tables</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {r.statements.map((s, n) => (
                          <TableRow key={`${String(s.line)}-${String(n)}`}>
                            <TableCell>{s.line}</TableCell>
                            <TableCell sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                              {s.type}
                            </TableCell>
                            <TableCell>{s.tables.join(', ') || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Stack>
            )}
          </OperationStatusView>
        </Panel>
      }
    />
  );
}
