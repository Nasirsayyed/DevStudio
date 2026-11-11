import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import type { JsonToXmlOptions } from '@/core/converters/xml';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CodegenLayout } from '../components/CodegenLayout';
import { NameField } from '../components/NameField';
import { useCodegenOperation } from '../hooks/useCodegenOperation';

type Options = Required<
  Pick<JsonToXmlOptions, 'rootName' | 'itemName' | 'attributePrefix' | 'indent' | 'declaration'>
>;

export default function JsonToXmlPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<Options>('codegen.json-to-xml', {
    rootName: 'root',
    itemName: 'item',
    attributePrefix: '@',
    indent: 2,
    declaration: true,
  });
  const payload = useMemo(
    () => (input.trim() ? { text: input, options: opts } : null),
    [input, opts],
  );
  const state = useCodegenOperation('jsonToXml', payload);
  return (
    <CodegenLayout
      toolId="codegen.json-to-xml"
      state={state}
      getOutput={(r) => ({
        text: r.xml,
        notes: r.renamed.length
          ? [
              `Renamed invalid XML names: ${r.renamed
                .slice(0, 5)
                .map((x) => `"${x.from}" → <${x.to}>`)
                .join(', ')}${r.renamed.length > 5 ? ', …' : ''}.`,
            ]
          : [],
      })}
      outputLanguage="xml"
      outputFilename="data.xml"
      outputMime="application/xml"
      historyOptions={opts}
      toolbar={
        <OptionsBar>
          <NameField
            label="Root element"
            value={opts.rootName}
            onChange={(rootName) => {
              setOpts({ rootName });
            }}
            width={140}
          />
          <NameField
            label="Array item element"
            value={opts.itemName}
            onChange={(itemName) => {
              setOpts({ itemName });
            }}
            width={160}
          />
          <NameField
            label="Attribute prefix"
            value={opts.attributePrefix}
            onChange={(attributePrefix) => {
              setOpts({ attributePrefix });
            }}
            width={130}
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
          <SwitchOption
            label="XML declaration"
            checked={opts.declaration}
            onChange={(declaration) => {
              setOpts({ declaration });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
