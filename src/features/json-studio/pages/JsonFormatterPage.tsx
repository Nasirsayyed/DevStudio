import { useMemo } from 'react';
import type { IndentOption } from '@/core/json/format';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { INDENT_OPTIONS } from '@/components/workspace/optionValues';
import { OptionsBar, SelectOption } from '@/components/workspace/OptionControls';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

export default function JsonFormatterPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<{ indent: IndentOption }>('json.formatter', {
    indent: 2,
  });
  const payload = useMemo(
    () => (input.trim() ? { text: input, indent: opts.indent } : null),
    [input, opts.indent],
  );
  return (
    <TransformLayout
      toolId="json.formatter"
      op="format"
      payload={payload}
      getOutput={(r) => r}
      outputFilename="formatted.json"
      sample={SAMPLE_ORDER_JSON}
      historyOptions={opts}
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Indentation"
            value={opts.indent}
            options={INDENT_OPTIONS}
            onChange={(indent) => {
              setOpts({ indent });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
