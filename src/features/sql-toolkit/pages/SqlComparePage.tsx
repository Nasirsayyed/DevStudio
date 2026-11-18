import { Alert, Box } from '@mui/material';
import { useMemo } from 'react';
import { DiffEditor, EmptyState, Panel } from '@/components';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { OptionsBar, SwitchOption } from '@/components/workspace/OptionControls';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { DialectSelect } from '../components/DialectSelect';
import { SqlInput } from '../components/SqlInput';
import { SqlCompareLayout } from '../components/SqlLayout';
import { useSqlOperation } from '../hooks';

export default function SqlComparePage() {
  const [opts, setOpts] = usePersistentOptions<{
    normalize: boolean;
    stripComments: boolean;
    sideBySide: boolean;
  }>('sql.compare', {
    normalize: true,
    stripComments: true,
    sideBySide: true,
  });
  const left = useDebouncedValue(
    useSqlWorkspaceStore((s) => s.sql),
    250,
  );
  const right = useDebouncedValue(
    useSqlWorkspaceStore((s) => s.right),
    250,
  );
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const payload = useMemo(
    () =>
      opts.normalize && left.trim() && right.trim()
        ? { left, right, dialect, options: { stripComments: opts.stripComments } }
        : null,
    [left, right, dialect, opts.normalize, opts.stripComments],
  );
  const state = useSqlOperation('compare', payload);
  const diff = (a: string, b: string) => (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      {a === b && (
        <Alert severity="success" sx={{ m: 1.5 }}>
          The scripts are equivalent{opts.normalize ? ' after formatting' : ''}.
        </Alert>
      )}
      <DiffEditor
        original={a}
        modified={b}
        language="sql"
        sideBySide={opts.sideBySide}
        ariaLabel="SQL differences"
      />
    </Box>
  );
  return (
    <SqlCompareLayout
      toolId="sql.compare"
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <SwitchOption
            label="Normalize formatting"
            checked={opts.normalize}
            onChange={(normalize) => {
              setOpts({ normalize });
            }}
          />
          {opts.normalize && (
            <SwitchOption
              label="Ignore comments"
              checked={opts.stripComments}
              onChange={(stripComments) => {
                setOpts({ stripComments });
              }}
            />
          )}
          <SwitchOption
            label="Side by side"
            checked={opts.sideBySide}
            onChange={(sideBySide) => {
              setOpts({ sideBySide });
            }}
          />
        </OptionsBar>
      }
      left={<SqlInput field="sql" title="Original SQL" saved />}
      right={<SqlInput field="right" title="Modified SQL" />}
      result={
        <Panel title="Differences" ariaLabel="Comparison" busy={state.status === 'running'}>
          {!left.trim() || !right.trim() ? (
            <EmptyState
              dense
              title="Nothing to compare yet"
              description="Paste or open SQL in both editors above."
            />
          ) : opts.normalize ? (
            <OperationStatusView state={state} emptyHint="Paste SQL in both editors.">
              {(r) => diff(r.left, r.right)}
            </OperationStatusView>
          ) : (
            diff(left, right)
          )}
        </Panel>
      }
    />
  );
}
