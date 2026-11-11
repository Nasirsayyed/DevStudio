import { Chip } from '@mui/material';
import { useMemo } from 'react';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

const DELIMITERS = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe (|)' },
] as const;

const SAMPLE = `[\n  ${JSON.stringify((JSON.parse(SAMPLE_ORDER_JSON) as { items: unknown[] }).items[0])},\n  ${JSON.stringify((JSON.parse(SAMPLE_ORDER_JSON) as { items: unknown[] }).items[1])}\n]`;

export default function JsonToCsvPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<{
    delimiter: string;
    header: boolean;
    flattenObjects: boolean;
    arrays: 'json' | 'expand';
    escapeFormulae: boolean;
  }>('json.to-csv', {
    delimiter: ',',
    header: true,
    flattenObjects: true,
    arrays: 'json',
    escapeFormulae: true,
  });
  const payload = useMemo(
    () =>
      input.trim()
        ? {
            text: input,
            options: {
              delimiter: opts.delimiter,
              header: opts.header,
              flattenObjects: opts.flattenObjects,
              arrays: opts.arrays,
              escapeFormulae: opts.escapeFormulae,
            },
          }
        : null,
    [input, opts.delimiter, opts.header, opts.flattenObjects, opts.arrays, opts.escapeFormulae],
  );
  return (
    <TransformLayout
      toolId="json.to-csv"
      op="toCsv"
      payload={payload}
      getOutput={(r) => r.csv}
      outputLanguage="plaintext"
      outputFilename={opts.delimiter === '\t' ? 'data.tsv' : 'data.csv'}
      outputMime={opts.delimiter === '\t' ? 'text/tab-separated-values' : 'text/csv'}
      canReuseOutput={false}
      sample={SAMPLE}
      historyOptions={opts}
      outputMeta={(r) => (
        <Chip
          size="small"
          variant="outlined"
          label={`${r.rowCount} rows × ${r.columns.length} columns`}
          sx={{ height: 20, fontSize: 11 }}
        />
      )}
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Delimiter"
            value={opts.delimiter as (typeof DELIMITERS)[number]['value']}
            options={DELIMITERS}
            onChange={(delimiter) => {
              setOpts({ delimiter });
            }}
          />
          <SelectOption
            label="Arrays"
            value={opts.arrays}
            options={[
              { value: 'json', label: 'As JSON text' },
              { value: 'expand', label: 'Expand columns' },
            ]}
            onChange={(arrays) => {
              setOpts({ arrays });
            }}
          />
          <SwitchOption
            label="Header row"
            checked={opts.header}
            onChange={(header) => {
              setOpts({ header });
            }}
          />
          <SwitchOption
            label="Flatten nested objects"
            checked={opts.flattenObjects}
            onChange={(flattenObjects) => {
              setOpts({ flattenObjects });
            }}
          />
          <SwitchOption
            label="Protect against formula injection"
            checked={opts.escapeFormulae}
            onChange={(escapeFormulae) => {
              setOpts({ escapeFormulae });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
