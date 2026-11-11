import { useMemo } from 'react';
import { INDENT_OPTIONS } from '@/components/workspace/optionValues';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import type { IndentOption } from '@/core/json/format';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CodegenLayout } from '../components/CodegenLayout';
import { NameField } from '../components/NameField';
import { useCodegenOperation } from '../hooks/useCodegenOperation';

interface Options {
  attributePrefix: string;
  textKey: string;
  parseValues: boolean;
  alwaysArray: boolean;
  indent: IndentOption;
}

export default function XmlToJsonPage() {
  const xml = useJsonWorkspaceStore((s) => s.xml);
  const [opts, setOpts] = usePersistentOptions<Options>('codegen.xml-to-json', {
    attributePrefix: '@',
    textKey: '#text',
    parseValues: true,
    alwaysArray: false,
    indent: 2,
  });
  const payload = useMemo(
    () =>
      xml.trim()
        ? {
            text: xml,
            indent: opts.indent,
            options: {
              attributePrefix: opts.attributePrefix,
              textKey: opts.textKey || '#text',
              parseValues: opts.parseValues,
              alwaysArray: opts.alwaysArray,
            },
          }
        : null,
    [xml, opts],
  );
  const state = useCodegenOperation('xmlToJson', payload);
  return (
    <CodegenLayout
      toolId="codegen.xml-to-json"
      inputKind="xml"
      state={state}
      getOutput={(r) => ({ text: r })}
      outputLanguage="json"
      outputFilename="data.json"
      outputMime="application/json"
      outputIsJson
      historyOptions={opts}
      toolbar={
        <OptionsBar>
          <NameField
            label="Attribute prefix"
            value={opts.attributePrefix}
            onChange={(attributePrefix) => {
              setOpts({ attributePrefix });
            }}
            width={130}
          />
          <NameField
            label="Text key"
            value={opts.textKey}
            onChange={(textKey) => {
              setOpts({ textKey });
            }}
            width={110}
          />
          <SelectOption
            label="Indentation"
            value={opts.indent}
            options={INDENT_OPTIONS}
            onChange={(indent) => {
              setOpts({ indent });
            }}
          />
          <SwitchOption
            label="Convert numbers & booleans"
            checked={opts.parseValues}
            onChange={(parseValues) => {
              setOpts({ parseValues });
            }}
          />
          <SwitchOption
            label="Always use arrays"
            checked={opts.alwaysArray}
            onChange={(alwaysArray) => {
              setOpts({ alwaysArray });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
