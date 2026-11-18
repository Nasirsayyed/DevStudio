import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { DEFAULT_PYTHON_OPTIONS, type PythonOptions } from '@/core/codegen/emitters/python';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CodegenLayout } from '../components/CodegenLayout';
import { NameField } from '../components/NameField';
import { useCodegenOperation } from '../hooks/useCodegenOperation';

export default function PythonGeneratorPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<PythonOptions>(
    'codegen.python',
    DEFAULT_PYTHON_OPTIONS,
  );
  const payload = useMemo(
    () => (input.trim() ? { text: input, options: opts } : null),
    [input, opts],
  );
  const state = useCodegenOperation('python', payload);
  return (
    <CodegenLayout
      toolId="codegen.python"
      state={state}
      getOutput={(r) => ({ text: r.code, notes: r.notes })}
      outputLanguage="python"
      outputFilename="models.py"
      outputMime="text/x-python"
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
          <SelectOption
            label="Style"
            value={opts.style}
            options={[
              { value: 'dataclass', label: 'dataclasses (3.10+)' },
              { value: 'pydantic', label: 'Pydantic v2' },
              { value: 'typeddict', label: 'TypedDict (3.11+)' },
            ]}
            onChange={(style) => {
              setOpts({ style });
            }}
            width={200}
          />
          <SwitchOption
            label="datetime / UUID types"
            checked={opts.richTypes}
            onChange={(richTypes) => {
              setOpts({ richTypes });
            }}
          />
          <SwitchOption
            label="dict[] for id-keyed objects"
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
