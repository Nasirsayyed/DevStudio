import { useMemo } from 'react';
import type { IndentOption } from '@/core/json/format';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { INDENT_OPTIONS } from '@/components/workspace/optionValues';
import { TransformLayout } from '../components/TransformLayout';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

export default function JsonSortKeysPage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const [opts, setOpts] = usePersistentOptions<{
    direction: 'asc' | 'desc';
    natural: boolean;
    caseInsensitive: boolean;
    indent: IndentOption;
  }>('json.sort-keys', { direction: 'asc', natural: true, caseInsensitive: false, indent: 2 });
  const payload = useMemo(
    () =>
      input.trim()
        ? {
            text: input,
            indent: opts.indent,
            options: {
              direction: opts.direction,
              natural: opts.natural,
              caseInsensitive: opts.caseInsensitive,
            },
          }
        : null,
    [input, opts.direction, opts.natural, opts.caseInsensitive, opts.indent],
  );
  return (
    <TransformLayout
      toolId="json.sort-keys"
      op="sortKeys"
      payload={payload}
      getOutput={(r) => r}
      outputFilename="sorted.json"
      sample={SAMPLE_ORDER_JSON}
      historyOptions={opts}
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Order"
            value={opts.direction}
            options={[
              { value: 'asc', label: 'A → Z' },
              { value: 'desc', label: 'Z → A' },
            ]}
            onChange={(direction) => {
              setOpts({ direction });
            }}
            width={120}
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
            label="Natural numbers (item2 < item10)"
            checked={opts.natural}
            onChange={(natural) => {
              setOpts({ natural });
            }}
          />
          <SwitchOption
            label="Ignore case"
            checked={opts.caseInsensitive}
            onChange={(caseInsensitive) => {
              setOpts({ caseInsensitive });
            }}
          />
        </OptionsBar>
      }
    />
  );
}
