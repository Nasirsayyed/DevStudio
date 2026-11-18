import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { DEFAULT_JAVA_OPTIONS, type JavaOptions } from '@/core/codegen/emitters/java';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { CodegenLayout } from '../components/CodegenLayout';
import { NameField } from '../components/NameField';
import { useCodegenOperation } from '../hooks/useCodegenOperation';

export default function JavaGeneratorPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<JavaOptions>('codegen.java', DEFAULT_JAVA_OPTIONS);
  const payload = useMemo(
    () => (input.trim() ? { text: input, options: opts } : null),
    [input, opts],
  );
  const state = useCodegenOperation('java', payload);
  return (
    <CodegenLayout
      toolId="codegen.java"
      state={state}
      getOutput={(r) => ({ text: r.code, files: r.files, notes: r.notes })}
      outputLanguage="java"
      outputFilename={`${opts.rootName || 'Root'}.java`}
      zipName="java-models.zip"
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
            label="Package"
            value={opts.packageName}
            onChange={(packageName) => {
              setOpts({ packageName });
            }}
            placeholder="(default package)"
            width={190}
          />
          <SelectOption
            label="Style"
            value={opts.style}
            options={[
              { value: 'class', label: 'Class + getters/setters' },
              { value: 'record', label: 'Record (Java 16+)' },
              { value: 'lombok', label: 'Lombok @Data' },
            ]}
            onChange={(style) => {
              setOpts({ style });
            }}
            width={210}
          />
          <SelectOption
            label="Dates"
            value={opts.dateType}
            options={[
              { value: 'java.time', label: 'java.time' },
              { value: 'String', label: 'String' },
            ]}
            onChange={(dateType) => {
              setOpts({ dateType });
            }}
            width={130}
          />
          <SwitchOption
            label="Jackson @JsonProperty"
            checked={opts.jackson}
            onChange={(jackson) => {
              setOpts({ jackson });
            }}
          />
          <SwitchOption
            label="UUID for uuid strings"
            checked={opts.useUuid}
            onChange={(useUuid) => {
              setOpts({ useUuid });
            }}
          />
          <SwitchOption
            label="Map<> for id-keyed objects"
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
