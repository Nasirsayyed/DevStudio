import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import {
  DEFAULT_TYPESCRIPT_OPTIONS,
  type TypeScriptOptions,
} from '@/core/codegen/emitters/typescript';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CodegenLayout } from '../components/CodegenLayout';
import { NameField } from '../components/NameField';
import { useCodegenOperation } from '../hooks/useCodegenOperation';

export default function TypeScriptGeneratorPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<TypeScriptOptions>(
    'codegen.typescript',
    DEFAULT_TYPESCRIPT_OPTIONS,
  );
  const payload = useMemo(
    () => (input.trim() ? { text: input, options: opts } : null),
    [input, opts],
  );
  const state = useCodegenOperation('typescript', payload);
  return (
    <CodegenLayout
      toolId="codegen.typescript"
      state={state}
      getOutput={(r) => ({ text: r.code, notes: r.notes })}
      outputLanguage="typescript"
      outputFilename="types.ts"
      outputMime="text/typescript"
      historyOptions={opts}
      toolbar={
        <OptionsBar>
          <NameField
            label="Root type"
            value={opts.rootName}
            onChange={(rootName) => {
              setOpts({ rootName });
            }}
            width={130}
          />
          <SelectOption
            label="Declare as"
            value={opts.declaration}
            options={[
              { value: 'interface', label: 'interface' },
              { value: 'type', label: 'type alias' },
            ]}
            onChange={(declaration) => {
              setOpts({ declaration });
            }}
            width={130}
          />
          <SelectOption
            label="Arrays"
            value={opts.arrayStyle}
            options={[
              { value: 'brackets', label: 'T[]' },
              { value: 'generic', label: 'Array<T>' },
            ]}
            onChange={(arrayStyle) => {
              setOpts({ arrayStyle });
            }}
            width={120}
          />
          <SelectOption
            label="ISO dates"
            value={opts.dateType}
            options={[
              { value: 'string', label: 'string' },
              { value: 'Date', label: 'Date' },
            ]}
            onChange={(dateType) => {
              setOpts({ dateType });
            }}
            width={120}
          />
          <SwitchOption
            label="export"
            checked={opts.exportTypes}
            onChange={(exportTypes) => {
              setOpts({ exportTypes });
            }}
          />
          <SwitchOption
            label="readonly"
            checked={opts.readonly}
            onChange={(readonly) => {
              setOpts({ readonly });
            }}
          />
          <SwitchOption
            label="Record<> for id-keyed objects"
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
