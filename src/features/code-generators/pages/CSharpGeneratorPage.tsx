import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { type CSharpOptions, DEFAULT_CSHARP_OPTIONS } from '@/core/codegen/emitters/csharp';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CodegenLayout } from '../components/CodegenLayout';
import { NameField } from '../components/NameField';
import { useCodegenOperation } from '../hooks/useCodegenOperation';

export default function CSharpGeneratorPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<CSharpOptions>(
    'codegen.csharp',
    DEFAULT_CSHARP_OPTIONS,
  );
  const payload = useMemo(
    () => (input.trim() ? { text: input, options: opts } : null),
    [input, opts],
  );
  const state = useCodegenOperation('csharp', payload);
  return (
    <CodegenLayout
      toolId="codegen.csharp"
      state={state}
      getOutput={(r) => ({ text: r.code, files: r.files, notes: r.notes })}
      outputLanguage="csharp"
      outputFilename={`${opts.rootName || 'Root'}.cs`}
      zipName="csharp-models.zip"
      historyOptions={opts}
      toolbar={
        <OptionsBar>
          <NameField
            label="Root class"
            value={opts.rootName}
            onChange={(rootName) => {
              setOpts({ rootName });
            }}
            width={130}
          />
          <NameField
            label="Namespace"
            value={opts.namespace}
            onChange={(namespace) => {
              setOpts({ namespace });
            }}
            placeholder="(none)"
          />
          <SelectOption
            label="Type"
            value={opts.typeKind}
            options={[
              { value: 'class', label: 'class' },
              { value: 'record', label: 'record' },
            ]}
            onChange={(typeKind) => {
              setOpts({ typeKind });
            }}
            width={110}
          />
          <SelectOption
            label="Attributes"
            value={opts.attributes}
            options={[
              { value: 'system-text-json', label: 'System.Text.Json' },
              { value: 'newtonsoft', label: 'Newtonsoft.Json' },
              { value: 'none', label: 'None' },
            ]}
            onChange={(attributes) => {
              setOpts({ attributes });
            }}
            width={170}
          />
          <SelectOption
            label="Add attributes"
            value={opts.attributeMode}
            options={[
              { value: 'always', label: 'Always' },
              { value: 'when-different', label: 'When names differ' },
            ]}
            onChange={(attributeMode) => {
              setOpts({ attributeMode });
            }}
            width={170}
          />
          <SelectOption
            label="Collections"
            value={opts.collectionType}
            options={[
              { value: 'List', label: 'List<T>' },
              { value: 'IReadOnlyList', label: 'IReadOnlyList<T>' },
              { value: 'Array', label: 'T[]' },
            ]}
            onChange={(collectionType) => {
              setOpts({ collectionType });
            }}
            width={160}
          />
          <SelectOption
            label="Decimals"
            value={opts.numberType}
            options={[
              { value: 'double', label: 'double' },
              { value: 'decimal', label: 'decimal' },
            ]}
            onChange={(numberType) => {
              setOpts({ numberType });
            }}
            width={120}
          />
          <SelectOption
            label="Dates"
            value={opts.dateType}
            options={[
              { value: 'DateTime', label: 'DateTime' },
              { value: 'DateTimeOffset', label: 'DateTimeOffset' },
              { value: 'string', label: 'string' },
            ]}
            onChange={(dateType) => {
              setOpts({ dateType });
            }}
            width={160}
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
          <SwitchOption
            label="Guid for UUIDs"
            checked={opts.useGuid}
            onChange={(useGuid) => {
              setOpts({ useGuid });
            }}
          />
          <SwitchOption
            label="Dictionaries for id-keyed objects"
            checked={opts.detectDictionaries}
            onChange={(detectDictionaries) => {
              setOpts({ detectDictionaries });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
