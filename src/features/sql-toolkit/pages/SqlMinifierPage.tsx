import { Chip } from '@mui/material';
import { useMemo } from 'react';
import { OutputPanel } from '@/components/workspace/OutputPanel';
import { OptionsBar, SwitchOption } from '@/components/workspace/OptionControls';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHistoryRecorder } from '@/hooks/useHistoryRecorder';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { DialectSelect } from '../components/DialectSelect';
import { SqlInput } from '../components/SqlInput';
import { SqlLayout } from '../components/SqlLayout';
import { useSqlOperation } from '../hooks';
import { SAMPLE_QUERY } from '../samples';

export default function SqlMinifierPage() {
  const [opts, setOpts] = usePersistentOptions<{ keepHints: boolean }>('sql.minifier', {
    keepHints: true,
  });
  const raw = useSqlWorkspaceStore((s) => s.sql);
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const set = useSqlWorkspaceStore((s) => s.set);
  const text = useDebouncedValue(raw, 200);
  const record = useHistoryRecorder('sql.minifier');
  const payload = useMemo(
    () => (text.trim() ? { text, dialect, options: opts } : null),
    [text, dialect, opts],
  );
  const state = useSqlOperation('minify', payload);
  const output = state.status === 'success' ? state.result : undefined;
  const saved =
    output !== undefined && raw.length > 0
      ? Math.round((1 - output.length / raw.length) * 100)
      : null;

  return (
    <SqlLayout
      toolId="sql.minifier"
      toolbar={
        <OptionsBar>
          <DialectSelect />
          <SwitchOption
            label="Keep optimizer hints (/*+ … */, /*! … */)"
            checked={opts.keepHints}
            onChange={(keepHints) => {
              setOpts({ keepHints });
            }}
          />
        </OptionsBar>
      }
      input={
        <SqlInput field="sql" title="SQL input" sample={SAMPLE_QUERY} saved onRun={state.run} />
      }
      output={
        <OutputPanel
          state={state}
          text={output}
          language="sql"
          filename="minified.sql"
          mimeType="application/sql"
          wordWrap
          emptyHint="Paste, type, drop or open SQL on the left."
          meta={
            saved !== null ? (
              <Chip
                size="small"
                variant="outlined"
                color="success"
                label={`−${String(saved)}%`}
                sx={{ height: 20, fontSize: 11 }}
              />
            ) : undefined
          }
          onExported={(kind) => {
            if (output !== undefined)
              record(`SQL minified (${kind})`, raw, output, { ...opts, dialect });
          }}
          onUseAsInput={(t) => {
            set({ sql: t });
          }}
        />
      }
    />
  );
}
