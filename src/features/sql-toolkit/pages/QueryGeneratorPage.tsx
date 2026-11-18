import { Box, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import { EmptyState, Panel } from '@/components';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { parseErrorFor } from '@/hooks/useTaskOperation';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { DialectSelect } from '../components/DialectSelect';
import { SqlInput } from '../components/SqlInput';
import { SqlLayout } from '../components/SqlLayout';
import {
  type BuilderSettings,
  StatementBuilder,
  type StatementKind,
} from '../components/StatementBuilder';
import { useSqlOperation } from '../hooks';
import { sampleSchema } from '../samples';

const KINDS: { value: StatementKind; label: string }[] = [
  { value: 'select', label: 'SELECT' },
  { value: 'insert', label: 'INSERT' },
  { value: 'update', label: 'UPDATE' },
  { value: 'delete', label: 'DELETE' },
];

const TOOL_OF: Record<StatementKind, string> = {
  select: 'sql.select-generator',
  insert: 'sql.insert-generator',
  update: 'sql.update-generator',
  delete: 'sql.delete-generator',
};

/**
 * One builder for all four statements. The SELECT/INSERT/UPDATE/DELETE generator tools open it
 * fixed to their statement; the Query Generator shows all four as tabs.
 */
export function StatementGenerator({ fixed }: { fixed?: StatementKind }) {
  const [settings, setSettings] = usePersistentOptions<BuilderSettings>('sql.query-generator', {
    valueMode: 'parameters',
    quoteAll: false,
    rowsPerStatement: 500,
  });
  const [tab, setTab] = useState<StatementKind>(fixed ?? 'select');
  const kind = fixed ?? tab;
  const [tableName, setTableName] = useState('');
  const raw = useSqlWorkspaceStore((s) => s.schema);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const text = useDebouncedValue(raw, 250);
  const payload = useMemo(() => (text.trim() ? { text, dialect } : null), [text, dialect]);
  const state = useSqlOperation('tables', payload);

  return (
    <SqlLayout
      toolId={fixed ? TOOL_OF[fixed] : 'sql.query-generator'}
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <SelectOption
            label="Values"
            value={settings.valueMode}
            options={[
              { value: 'parameters', label: 'Parameters' },
              { value: 'literals', label: 'Literal values' },
            ]}
            width={150}
            onChange={(valueMode) => {
              setSettings({ valueMode });
            }}
          />
          <SwitchOption
            label="Quote every identifier"
            checked={settings.quoteAll}
            onChange={(quoteAll) => {
              setSettings({ quoteAll });
            }}
          />
          {kind === 'insert' && (
            <SelectOption
              label="Rows per INSERT"
              value={settings.rowsPerStatement}
              options={[
                { value: 1, label: '1' },
                { value: 100, label: '100' },
                { value: 500, label: '500' },
                { value: 1000, label: '1,000' },
              ]}
              width={140}
              onChange={(rowsPerStatement) => {
                setSettings({ rowsPerStatement });
              }}
            />
          )}
        </OptionsBar>
      }
      input={
        <SqlInput
          field="schema"
          title="CREATE TABLE statements"
          sample={sampleSchema(dialect)}
          saved
          error={parseErrorFor(state.error)}
          valid={state.status === 'success'}
          onRun={state.run}
        />
      }
      output={
        <Panel title="Statement" busy={state.status === 'running'}>
          {!fixed && (
            <Tabs
              value={tab}
              onChange={(_, v: StatementKind) => {
                setTab(v);
              }}
              aria-label="Statement"
              sx={{ px: 1.5, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
            >
              {KINDS.map((k) => (
                <Tab key={k.value} value={k.value} label={k.label} sx={{ minHeight: 40 }} />
              ))}
            </Tabs>
          )}
          <OperationStatusView
            state={state}
            emptyHint="Paste CREATE TABLE statements on the left (or load the sample) to build statements."
          >
            {(tables) => {
              const table = tables.find((t) => t.name === tableName) ?? tables[0];
              if (!table)
                return (
                  <EmptyState dense title="No tables" description="Add a CREATE TABLE statement." />
                );
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <Box sx={{ px: 2, pt: 2 }}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      label="Table"
                      value={table.name}
                      onChange={(e) => {
                        setTableName(e.target.value);
                      }}
                    >
                      {tables.map((t) => (
                        <MenuItem key={`${t.schema ?? ''}.${t.name}`} value={t.name}>
                          {t.schema ? `${t.schema}.${t.name}` : t.name} ({t.columns.length} columns)
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <StatementBuilder
                    key={`${kind}:${table.name}`}
                    kind={kind}
                    table={table}
                    tables={tables}
                    dialect={dialect}
                    settings={settings}
                  />
                </Box>
              );
            }}
          </OperationStatusView>
        </Panel>
      }
    />
  );
}

export default function QueryGeneratorPage() {
  return <StatementGenerator />;
}
