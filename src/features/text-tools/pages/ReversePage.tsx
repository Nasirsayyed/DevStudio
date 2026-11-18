import { useMemo } from 'react';
import { OptionsBar, SelectOption } from '@/components/workspace/OptionControls';
import { REVERSE_MODES, type ReverseMode } from '@/core/text/reverse';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { TransformOutput } from '../components/TransformOutput';
import { TextInput } from '../components/TextInput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_TEXT } from '../samples';

export default function ReversePage() {
  const [opts, setOpts] = usePersistentOptions<{ mode: ReverseMode }>('text.reverse', {
    mode: 'characters',
  });
  const raw = useTextWorkspaceStore((s) => s.text);
  const set = useTextWorkspaceStore((s) => s.set);
  const text = useDebouncedValue(raw, 120);
  const payload = useMemo(() => (text ? { text, mode: opts.mode } : null), [text, opts.mode]);
  const state = useTextOperation('reverse', payload);
  return (
    <TextToolLayout
      toolId="text.reverse"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Reverse"
            value={opts.mode}
            width={240}
            options={REVERSE_MODES.map((m) => ({ value: m.id, label: m.label }))}
            onChange={(mode) => {
              setOpts({ mode });
            }}
          />
        </OptionsBar>
      }
      input={<TextInput field="text" title="Text" sample={SAMPLE_TEXT} />}
      output={
        <TransformOutput
          toolId="text.reverse"
          label="Reverse"
          state={state}
          text={state.status === 'success' ? state.result : undefined}
          input={raw}
          historyOptions={opts}
          onUseAsInput={(t) => {
            set({ text: t });
          }}
        />
      }
    />
  );
}
