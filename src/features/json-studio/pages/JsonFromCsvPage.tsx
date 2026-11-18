import { Alert, Chip } from '@mui/material';
import { useMemo } from 'react';
import { CSV_FILE_RULES } from '@/core/files/fileValidation';
import { SAMPLE_USERS_CSV } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

const DELIMITERS = [
  { value: '', label: 'Auto-detect' },
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe (|)' },
] as const;

export default function JsonFromCsvPage() {
  const csv = useJsonWorkspaceStore((s) => s.csv);
  const [opts, setOpts] = usePersistentOptions('json.from-csv', {
    delimiter: '',
    header: true,
    dynamicTyping: true,
    nest: false,
  });
  const payload = useMemo(
    () =>
      csv.trim()
        ? {
            text: csv,
            options: {
              delimiter: opts.delimiter,
              header: opts.header,
              dynamicTyping: opts.dynamicTyping,
              nest: opts.nest,
            },
          }
        : null,
    [csv, opts.delimiter, opts.header, opts.dynamicTyping, opts.nest],
  );
  return (
    <TransformLayout
      toolId="json.from-csv"
      op="fromCsv"
      payload={payload}
      getOutput={(r) => r.text}
      outputFilename="data.json"
      inputKind="csv"
      inputRules={CSV_FILE_RULES}
      sample={SAMPLE_USERS_CSV}
      historyOptions={opts}
      outputMeta={(r) => (
        <Chip
          size="small"
          variant="outlined"
          label={`${r.rowCount} rows · delimiter ${r.delimiter === '\t' ? 'tab' : `"${r.delimiter}"`}`}
          sx={{ height: 20, fontSize: 11 }}
        />
      )}
      outputWarnings={(r) =>
        r.issues.length > 0 ? (
          <Alert severity="warning" variant="outlined" sx={{ m: 1.5, mb: 0, borderRadius: 2 }}>
            {r.issues
              .slice(0, 3)
              .map((i) => `${i.row !== null ? `Row ${i.row}: ` : ''}${i.message}`)
              .join(' · ')}
            {r.issues.length > 3 ? ` · and ${r.issues.length - 3} more` : ''}
          </Alert>
        ) : null
      }
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
          <SwitchOption
            label="First row is header"
            checked={opts.header}
            onChange={(header) => {
              setOpts({ header });
            }}
          />
          <SwitchOption
            label="Convert numbers & booleans"
            checked={opts.dynamicTyping}
            onChange={(dynamicTyping) => {
              setOpts({ dynamicTyping });
            }}
          />
          <SwitchOption
            label="Nest dotted headers"
            checked={opts.nest}
            onChange={(nest) => {
              setOpts({ nest });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
