import { useMemo } from 'react';
import { JsonInputPanel } from '@/components/workspace/JsonInputPanel';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { XML_FILE_RULES } from '@/core/files/fileValidation';
import type { XmlFormatOptions } from '@/core/formatters/xml';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { parseErrorFor } from '@/hooks/useTaskOperation';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CountChip, TransformOutput } from '../components/TransformOutput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_XML } from '../samples';

interface Options extends Pick<
  XmlFormatOptions,
  'indent' | 'attributesPerLine' | 'selfCloseEmpty' | 'removeComments'
> {
  mode: 'format' | 'minify';
}

export default function XmlFormatterPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('text.xml-formatter', {
    mode: 'format',
    indent: 2,
    attributesPerLine: 'auto',
    selfCloseEmpty: true,
    removeComments: false,
  });
  // Shared with XML → JSON (Code Generators), so the same XML is available in both tools.
  const raw = useJsonWorkspaceStore((s) => s.xml);
  const setXml = useJsonWorkspaceStore((s) => s.setXml);
  const xml = useDebouncedValue(raw, 200);
  const formatPayload = useMemo(
    () => (xml.trim() && opts.mode === 'format' ? { text: xml, options: opts } : null),
    [xml, opts],
  );
  const minifyPayload = useMemo(
    () =>
      xml.trim() && opts.mode === 'minify'
        ? { text: xml, removeComments: opts.removeComments }
        : null,
    [xml, opts.mode, opts.removeComments],
  );
  const formatted = useTextOperation('xmlFormat', formatPayload);
  const minified = useTextOperation('xmlMinify', minifyPayload);
  const state = opts.mode === 'format' ? formatted : minified;
  const result = state.status === 'success' ? state.result : undefined;

  return (
    <TextToolLayout
      toolId="text.xml-formatter"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Mode"
            value={opts.mode}
            options={[
              { value: 'format', label: 'Format' },
              { value: 'minify', label: 'Minify' },
            ]}
            onChange={(mode) => {
              setOpts({ mode });
            }}
            width={120}
          />
          {opts.mode === 'format' && (
            <>
              <SelectOption
                label="Indent"
                value={opts.indent}
                options={[
                  { value: 2, label: '2 spaces' },
                  { value: 4, label: '4 spaces' },
                  { value: 'tab', label: 'Tabs' },
                ]}
                onChange={(indent) => {
                  setOpts({ indent });
                }}
                width={120}
              />
              <SelectOption
                label="Attributes"
                value={opts.attributesPerLine}
                options={[
                  { value: 'auto', label: 'Wrap long tags' },
                  { value: 'always', label: 'One per line' },
                  { value: 'never', label: 'Same line' },
                ]}
                onChange={(attributesPerLine) => {
                  setOpts({ attributesPerLine });
                }}
                width={160}
              />
              <SwitchOption
                label="Self-close empty elements"
                checked={opts.selfCloseEmpty}
                onChange={(selfCloseEmpty) => {
                  setOpts({ selfCloseEmpty });
                }}
              />
            </>
          )}
          <SwitchOption
            label="Remove comments"
            checked={opts.removeComments}
            onChange={(removeComments) => {
              setOpts({ removeComments });
            }}
          />
        </OptionsBar>
      }
      input={
        <JsonInputPanel
          title="XML input"
          value={raw}
          onChange={setXml}
          language="xml"
          rules={XML_FILE_RULES}
          sample={SAMPLE_XML}
          error={parseErrorFor(state.error)}
          valid={state.status === 'success'}
          onRun={state.run}
        />
      }
      output={
        <TransformOutput
          toolId="text.xml-formatter"
          label={opts.mode === 'format' ? 'XML formatted' : 'XML minified'}
          state={state}
          text={result?.text}
          input={raw}
          language="xml"
          filename={opts.mode === 'format' ? 'formatted.xml' : 'minified.xml'}
          mimeType="application/xml"
          historyOptions={opts}
          emptyHint="Paste, type, drop or open XML on the left."
          onUseAsInput={setXml}
          meta={
            result ? (
              <CountChip
                label={`${result.stats.elements.toLocaleString()} elements · depth ${String(result.stats.maxDepth)}`}
              />
            ) : undefined
          }
        />
      }
    />
  );
}
