import { Alert } from '@mui/material';
import { useMemo } from 'react';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { JSON_FILE_RULES, YAML_FILE_RULES } from '@/core/files/fileValidation';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { parseErrorFor } from '@/hooks/useTaskOperation';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { CountChip, TransformOutput } from '../components/TransformOutput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_YAML } from '../samples';

interface Options {
  mode: 'format' | 'to-json' | 'from-json';
  indent: 2 | 4;
  sortKeys: boolean;
  indentSequences: boolean;
  quote: 'auto' | 'single' | 'double';
  lineWidth: 0 | 80 | 120;
}

export default function YamlFormatterPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('text.yaml-formatter', {
    mode: 'format',
    indent: 2,
    sortKeys: false,
    indentSequences: true,
    quote: 'auto',
    lineWidth: 0,
  });
  const yaml = useTextWorkspaceStore((s) => s.yaml);
  const setText = useTextWorkspaceStore((s) => s.set);
  // JSON → YAML reads the JSON document shared with JSON Studio and the generators.
  const json = useJsonWorkspaceStore((s) => s.input);
  const setJson = useJsonWorkspaceStore((s) => s.setInput);
  const loadDocument = useJsonWorkspaceStore((s) => s.loadDocument);
  const fromJson = opts.mode === 'from-json';
  const raw = fromJson ? json : yaml;
  const text = useDebouncedValue(raw, 200);
  const { mode, indent, sortKeys, indentSequences, quote, lineWidth } = opts;
  const format = useMemo(
    () => ({ indent, sortKeys, indentSequences, quote, lineWidth }),
    [indent, sortKeys, indentSequences, quote, lineWidth],
  );
  const formatPayload = useMemo(
    () => (mode === 'format' && text.trim() ? { text, options: format } : null),
    [text, mode, format],
  );
  const toJsonPayload = useMemo(
    () => (mode === 'to-json' && text.trim() ? { text, indent } : null),
    [text, mode, indent],
  );
  const fromJsonPayload = useMemo(
    () => (mode === 'from-json' && text.trim() ? { text, options: format } : null),
    [text, mode, format],
  );
  const formatState = useTextOperation('yamlFormat', formatPayload);
  const toJsonState = useTextOperation('yamlToJson', toJsonPayload);
  const fromJsonState = useTextOperation('jsonToYaml', fromJsonPayload);
  const state =
    opts.mode === 'format' ? formatState : opts.mode === 'to-json' ? toJsonState : fromJsonState;
  const result = state.status === 'success' ? state.result : undefined;
  const outputJson = opts.mode === 'to-json';

  return (
    <TextToolLayout
      toolId="text.yaml-formatter"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Mode"
            value={opts.mode}
            options={[
              { value: 'format', label: 'Format YAML' },
              { value: 'to-json', label: 'YAML → JSON' },
              { value: 'from-json', label: 'JSON → YAML' },
            ]}
            onChange={(mode) => {
              setOpts({ mode });
            }}
            width={160}
          />
          <SelectOption
            label="Indent"
            value={opts.indent}
            options={[
              { value: 2, label: '2 spaces' },
              { value: 4, label: '4 spaces' },
            ]}
            onChange={(indent) => {
              setOpts({ indent });
            }}
            width={120}
          />
          {!outputJson && (
            <>
              <SelectOption
                label="Quotes"
                value={opts.quote}
                options={[
                  { value: 'auto', label: 'Only when needed' },
                  { value: 'double', label: 'Prefer "double"' },
                  { value: 'single', label: "Prefer 'single'" },
                ]}
                onChange={(quote) => {
                  setOpts({ quote });
                }}
                width={170}
              />
              <SelectOption
                label="Wrap at"
                value={opts.lineWidth}
                options={[
                  { value: 0, label: 'Never' },
                  { value: 80, label: '80 columns' },
                  { value: 120, label: '120 columns' },
                ]}
                onChange={(lineWidth) => {
                  setOpts({ lineWidth });
                }}
                width={130}
              />
              <SwitchOption
                label="Sort keys"
                checked={opts.sortKeys}
                onChange={(sortKeys) => {
                  setOpts({ sortKeys });
                }}
              />
              <SwitchOption
                label="Indent lists"
                checked={opts.indentSequences}
                onChange={(indentSequences) => {
                  setOpts({ indentSequences });
                }}
              />
            </>
          )}
        </OptionsBar>
      }
      input={
        fromJson ? (
          <JsonInputPanel
            title="JSON input"
            value={json}
            onChange={setJson}
            documents
            rules={JSON_FILE_RULES}
            sample={SAMPLE_ORDER_JSON}
            error={parseErrorFor(state.error)}
            valid={state.status === 'success'}
            onRun={state.run}
          />
        ) : (
          <JsonInputPanel
            title="YAML input"
            value={yaml}
            onChange={(v) => {
              setText({ yaml: v });
            }}
            language="yaml"
            rules={YAML_FILE_RULES}
            sample={SAMPLE_YAML}
            error={parseErrorFor(state.error)}
            valid={state.status === 'success'}
            onRun={state.run}
          />
        )
      }
      output={
        <TransformOutput
          toolId="text.yaml-formatter"
          label={
            opts.mode === 'format' ? 'YAML formatted' : outputJson ? 'YAML → JSON' : 'JSON → YAML'
          }
          state={state}
          text={result?.text}
          input={raw}
          language={outputJson ? 'json' : 'yaml'}
          filename={outputJson ? 'data.json' : 'data.yaml'}
          mimeType={outputJson ? 'application/json' : 'application/yaml'}
          historyOptions={opts}
          emptyHint={
            fromJson
              ? 'Paste, type, drop or open JSON on the left.'
              : 'Paste, type, drop or open YAML on the left.'
          }
          useAsInputLabel={outputJson ? 'Use as JSON document' : 'Use output as YAML input'}
          onUseAsInput={(t) => {
            if (outputJson) loadDocument(t, null);
            else {
              setText({ yaml: t });
              if (fromJson) setOpts({ mode: 'format' });
            }
          }}
          meta={
            result && result.documents > 1 ? (
              <CountChip label={`${String(result.documents)} documents`} />
            ) : undefined
          }
          warnings={
            result && result.warnings.length > 0 ? (
              <Alert severity="warning" variant="outlined" sx={{ m: 1.5, mb: 0, borderRadius: 2 }}>
                {result.warnings.slice(0, 3).join(' ')}
              </Alert>
            ) : undefined
          }
        />
      }
    />
  );
}
