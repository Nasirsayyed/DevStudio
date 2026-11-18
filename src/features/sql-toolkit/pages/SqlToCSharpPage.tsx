import { TextField } from '@mui/material';
import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import type { SqlCSharpOptions } from '@/core/sql/toCode';
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

export default function SqlToCSharpPage() {
  const [opts, setOpts] = usePersistentOptions<SqlCSharpOptions>('sql.to-csharp', {
    namespace: 'MyApp.Data',
    fileScopedNamespace: true,
    nullableReferenceTypes: true,
    typeKind: 'class',
    dateType: 'DateTime',
    requiredMembers: false,
    annotations: true,
  });
  const raw = useSqlWorkspaceStore((s) => s.schema);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const text = useDebouncedValue(raw, 250);
  const payload = useMemo(
    () => (text.trim() ? { text, dialect, options: opts } : null),
    [text, dialect, opts],
  );
  const state = useSqlOperation('toCSharp', payload);
  return (
    <SqlLayout
      toolId="sql.to-csharp"
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <TextField
            size="small"
            label="Namespace"
            value={opts.namespace}
            onChange={(e) => {
              setOpts({ namespace: e.target.value });
            }}
            sx={{ width: 180 }}
          />
          <SelectOption
            label="Type"
            value={opts.typeKind}
            options={[
              { value: 'class', label: 'class' },
              { value: 'record', label: 'record' },
            ]}
            width={110}
            onChange={(typeKind) => {
              setOpts({ typeKind });
            }}
          />
          <SelectOption
            label="Dates"
            value={opts.dateType}
            options={[
              { value: 'DateTime', label: 'DateTime' },
              { value: 'DateTimeOffset', label: 'DateTimeOffset' },
              { value: 'string', label: 'string' },
            ]}
            width={160}
            onChange={(dateType) => {
              setOpts({ dateType });
            }}
          />
          <SwitchOption
            label="Data annotations (EF Core)"
            checked={opts.annotations}
            onChange={(annotations) => {
              setOpts({ annotations });
            }}
          />
          <SwitchOption
            label="Nullable reference types"
            checked={opts.nullableReferenceTypes}
            onChange={(nullableReferenceTypes) => {
              setOpts({ nullableReferenceTypes });
            }}
          />
          <SwitchOption
            label="File-scoped namespace"
            checked={opts.fileScopedNamespace}
            onChange={(fileScopedNamespace) => {
              setOpts({ fileScopedNamespace });
            }}
          />
          <SwitchOption
            label="required members"
            checked={opts.requiredMembers}
            onChange={(requiredMembers) => {
              setOpts({ requiredMembers });
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
          toolId="sql.to-csharp"
          label="SQL to C#"
          state={state}
          input={raw}
          language="csharp"
          filename="Entities.cs"
          zipName="entities.zip"
          historyOptions={{ ...opts, dialect }}
        />
      }
    />
  );
}
