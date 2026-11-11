import { useMemo } from 'react';
import type { IndentOption } from '@/core/json/format';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { OptionsBar, SelectOption, SwitchOption } from '../components/OptionControls';
import { INDENT_OPTIONS } from '../components/optionValues';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonStudioStore } from '../store';

const WIDTHS = [
  { value: 0, label: 'Never inline' },
  { value: 60, label: '60 columns' },
  { value: 80, label: '80 columns' },
  { value: 120, label: '120 columns' },
] as const;

export default function JsonBeautifierPage() {
  const input = useJsonStudioStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<{
    indent: IndentOption;
    sortKeys: boolean;
    maxInlineWidth: number;
  }>('json.beautifier', { indent: 2, sortKeys: false, maxInlineWidth: 80 });
  const payload = useMemo(
    () =>
      input.trim()
        ? {
            text: input,
            options: {
              indent: opts.indent,
              sortKeys: opts.sortKeys,
              maxInlineWidth: opts.maxInlineWidth,
            },
          }
        : null,
    [input, opts.indent, opts.sortKeys, opts.maxInlineWidth],
  );
  return (
    <TransformLayout
      toolId="json.beautifier"
      op="beautify"
      payload={payload}
      getOutput={(r) => r}
      outputFilename="beautified.json"
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
          <SelectOption
            label="Inline short arrays"
            value={opts.maxInlineWidth as 0 | 60 | 80 | 120}
            options={WIDTHS}
            onChange={(maxInlineWidth) => {
              setOpts({ maxInlineWidth });
            }}
            width={170}
          />
          <SwitchOption
            label="Sort keys"
            checked={opts.sortKeys}
            onChange={(sortKeys) => {
              setOpts({ sortKeys });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
