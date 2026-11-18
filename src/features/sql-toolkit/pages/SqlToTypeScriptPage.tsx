import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import type { SqlTypeScriptOptions } from '@/core/sql/toCode';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { parseErrorFor } from '@/hooks/useTaskOperation';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { DialectSelect } from '../components/DialectSelect';
import { GeneratedCodeOutput } from '../components/GeneratedCodeOutput';
import { SqlInput } from '../components/SqlInput';
import { SqlLayout } from '../components/SqlLayout';
import { useSqlOperation } from '../hooks';
import { sampleSchema } from '../samples';

export default function SqlToTypeScriptPage() {
  const [opts, setOpts] = usePersistentOptions<SqlTypeScriptOptions>('sql.to-typescript', {
    declaration: 'interface',
    readonly: false,
    dateType: 'string',
    exportTypes: true,
    propertyNames: 'camel',
  });
  const raw = useSqlWorkspaceStore((s) => s.schema);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const text = useDebouncedValue(raw, 250);
  const payload = useMemo(
    () => (text.trim() ? { text, dialect, options: opts } : null),
    [text, dialect, opts],
  );
  const state = useSqlOperation('toTypeScript', payload);
  return (
    <SqlLayout
      toolId="sql.to-typescript"
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <SelectOption
            label="Declare as"
            value={opts.declaration}
            options={[
              { value: 'interface', label: 'interface' },
              { value: 'type', label: 'type' },
            ]}
            width={130}
            onChange={(declaration) => {
              setOpts({ declaration });
            }}
          />
          <SelectOption
            label="Property names"
            value={opts.propertyNames}
            options={[
              { value: 'camel', label: 'camelCase' },
              { value: 'column', label: 'As in the database' },
            ]}
            width={180}
            onChange={(propertyNames) => {
              setOpts({ propertyNames });
            }}
          />
          <SelectOption
            label="Dates"
            value={opts.dateType}
            options={[
              { value: 'string', label: 'string' },
              { value: 'Date', label: 'Date' },
            ]}
            width={110}
            onChange={(dateType) => {
              setOpts({ dateType });
            }}
          />
          <SwitchOption
            label="readonly"
            checked={opts.readonly}
            onChange={(readonly) => {
              setOpts({ readonly });
            }}
          />
          <SwitchOption
            label="export"
            checked={opts.exportTypes}
            onChange={(exportTypes) => {
              setOpts({ exportTypes });
            }}
          />
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
        <GeneratedCodeOutput
          toolId="sql.to-typescript"
          label="SQL to TypeScript"
          state={state}
          input={raw}
          language="typescript"
          filename="types.ts"
          historyOptions={{ ...opts, dialect }}
        />
      }
    />
  );
}
