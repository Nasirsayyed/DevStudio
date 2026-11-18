import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { DEFAULT_SQL_TABLE_OPTIONS, type SqlTableOptions } from '@/core/codegen/emitters/sqlTable';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CodegenLayout } from '../components/CodegenLayout';
import { NameField } from '../components/NameField';
import { useCodegenOperation } from '../hooks/useCodegenOperation';

const DIALECTS = [
  { value: 'mssql', label: 'SQL Server' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
] as const;

export default function SqlTableGeneratorPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<SqlTableOptions>('codegen.sql-table', {
    ...DEFAULT_SQL_TABLE_OPTIONS,
    tableName: 'orders',
  });
  const payload = useMemo(
    () => (input.trim() ? { text: input, options: opts } : null),
    [input, opts],
  );
  const state = useCodegenOperation('sqlTable', payload);
  return (
    <CodegenLayout
      toolId="codegen.sql-table"
      state={state}
      getOutput={(r) => ({ text: r.code, notes: r.notes })}
      outputLanguage="sql"
      outputFilename={`${opts.tableName || 'table'}.sql`}
      outputMime="application/sql"
      historyOptions={opts}
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Dialect"
            value={opts.dialect}
            options={DIALECTS}
            onChange={(dialect) => {
              setOpts({ dialect });
            }}
            width={150}
          />
          <NameField
            label="Table name"
            value={opts.tableName}
            onChange={(tableName) => {
              setOpts({ tableName });
            }}
            width={150}
          />
          <SelectOption
            label="Nested objects"
            value={opts.objects}
            options={[
              { value: 'flatten', label: 'Flatten into columns' },
              { value: 'json', label: 'JSON column' },
            ]}
            onChange={(objects) => {
              setOpts({ objects });
            }}
            width={190}
          />
          <SelectOption
            label="Arrays"
            value={opts.arrays}
            options={[
              { value: 'child-tables', label: 'Child tables + FK' },
              { value: 'json', label: 'JSON column' },
            ]}
            onChange={(arrays) => {
              setOpts({ arrays });
            }}
            width={180}
          />
          <SwitchOption
            label="Detect primary key (id)"
            checked={opts.detectPrimaryKey}
            onChange={(detectPrimaryKey) => {
              setOpts({ detectPrimaryKey });
            }}
          />
          <SwitchOption
            label="INSERT sample rows"
            checked={opts.includeInserts}
            onChange={(includeInserts) => {
              setOpts({ includeInserts });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
