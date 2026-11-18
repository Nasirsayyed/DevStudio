import { useMemo } from 'react';
import { OutputPanel } from '@/components/workspace/OutputPanel';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { DEFAULT_SQL_FORMAT, type SqlFormatOptions } from '@/core/sql/format';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { parseErrorFor } from '@/hooks/useTaskOperation';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { DialectSelect } from '../components/DialectSelect';
import { SqlInput } from '../components/SqlInput';
import { SqlLayout } from '../components/SqlLayout';
import { useSqlOperation } from '../hooks';
import { SAMPLE_QUERY } from '../samples';

const CASE = [
  { value: 'upper', label: 'UPPER' },
  { value: 'lower', label: 'lower' },
  { value: 'preserve', label: 'Keep' },
] as const;

export default function SqlFormatterPage() {
  const [opts, setOpts] = usePersistentOptions<SqlFormatOptions>(
    'sql.formatter',
    DEFAULT_SQL_FORMAT,
  );
  const raw = useSqlWorkspaceStore((s) => s.sql);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const set = useSqlWorkspaceStore((s) => s.set);
  const text = useDebouncedValue(raw, 200);
  const record = useHistoryRecorder('sql.formatter');
  const payload = useMemo(
    () => (text.trim() ? { text, dialect, options: opts } : null),
    [text, dialect, opts],
  );
  const state = useSqlOperation('format', payload);
  const output = state.status === 'success' ? state.result : undefined;

  return (
    <SqlLayout
      toolId="sql.formatter"
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <SelectOption
            label="Keywords"
            value={opts.keywordCase}
            options={CASE}
            width={120}
            onChange={(keywordCase) => {
              setOpts({ keywordCase });
            }}
          />
          <SelectOption
            label="Data types"
            value={opts.dataTypeCase}
            options={CASE}
            width={120}
            onChange={(dataTypeCase) => {
              setOpts({ dataTypeCase });
            }}
          />
          <SelectOption
            label="Functions"
            value={opts.functionCase}
            options={CASE}
            width={120}
            onChange={(functionCase) => {
              setOpts({ functionCase });
            }}
          />
          <SelectOption
            label="Indent"
            value={opts.indent}
            options={[
              { value: 2, label: '2 spaces' },
              { value: 4, label: '4 spaces' },
              { value: 'tab', label: 'Tabs' },
            ]}
            width={120}
            onChange={(indent) => {
              setOpts({ indent });
            }}
          />
          <SelectOption
            label="Style"
            value={opts.indentStyle}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'tabularLeft', label: 'Aligned (left)' },
              { value: 'tabularRight', label: 'Aligned (right)' },
            ]}
            width={150}
            onChange={(indentStyle) => {
              setOpts({ indentStyle });
            }}
          />
          <SelectOption
            label="AND / OR"
            value={opts.logicalOperatorNewline}
            options={[
              { value: 'before', label: 'Start of line' },
              { value: 'after', label: 'End of line' },
            ]}
            width={140}
            onChange={(logicalOperatorNewline) => {
              setOpts({ logicalOperatorNewline });
            }}
          />
          <SelectOption
            label="Blank lines between"
            value={opts.linesBetweenQueries}
            options={[
              { value: 0, label: '0' },
              { value: 1, label: '1' },
              { value: 2, label: '2' },
            ]}
            width={150}
            onChange={(linesBetweenQueries) => {
              setOpts({ linesBetweenQueries });
            }}
          />
          <SwitchOption
            label="Dense operators"
            checked={opts.denseOperators}
            onChange={(denseOperators) => {
              setOpts({ denseOperators });
            }}
          />
          <SwitchOption
            label="; on its own line"
            checked={opts.newlineBeforeSemicolon}
            onChange={(newlineBeforeSemicolon) => {
              setOpts({ newlineBeforeSemicolon });
            }}
          />
        </OptionsBar>
      }
      input={
        <SqlInput
          field="sql"
          title="SQL input"
          sample={SAMPLE_QUERY}
          saved
          error={parseErrorFor(state.error)}
          valid={state.status === 'success'}
          onRun={state.run}
        />
      }
      output={
        <OutputPanel
          state={state}
          text={output}
          language="sql"
          filename="formatted.sql"
          mimeType="application/sql"
          wordWrap={false}
          emptyHint="Paste, type, drop or open SQL on the left."
          onExported={(kind) => {
            if (output !== undefined)
              record(`SQL formatted (${kind})`, raw, output, { ...opts, dialect });
          }}
          onUseAsInput={(t) => {
            set({ sql: t });
          }}
        />
      }
    />
  );
}
