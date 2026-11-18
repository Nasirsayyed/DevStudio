import { TextField } from '@mui/material';
import { useMemo } from 'react';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { DEFAULT_LINE_OPTIONS, type LineOptions } from '@/core/text/lines';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { CountChip, TransformOutput } from '../components/TransformOutput';
import { TextInput } from '../components/TextInput';
import { TextToolLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_TEXT } from '../samples';

export default function LineToolsPage() {
  const [opts, setOpts] = usePersistentOptions<LineOptions>('text.line-tools', {
    ...DEFAULT_LINE_OPTIONS,
    dedupe: 'exact',
    removeEmpty: true,
    trim: 'both',
  });
  const raw = useTextWorkspaceStore((s) => s.text);
  const set = useTextWorkspaceStore((s) => s.set);
  const text = useDebouncedValue(raw, 150);
  // Shuffling re-runs on every change on purpose; other options are deterministic.
  const payload = useMemo(() => (text ? { text, options: opts } : null), [text, opts]);
  const state = useTextOperation('lines', payload);
  const r = state.status === 'success' ? state.result : undefined;
  const field = (label: string, key: 'prefix' | 'suffix' | 'filterText', width = 140) => (
    <TextField
      size="small"
      label={label}
      value={opts[key]}
      onChange={(e) => {
        setOpts({ [key]: e.target.value });
      }}
      sx={{ width }}
    />
  );

  return (
    <TextToolLayout
      toolId="text.line-tools"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="Sort"
            value={opts.sort}
            width={190}
            options={[
              { value: 'none', label: 'Keep order' },
              { value: 'asc', label: 'A → Z' },
              { value: 'desc', label: 'Z → A' },
              { value: 'natural', label: 'Natural (file2 < file10)' },
              { value: 'natural-desc', label: 'Natural, descending' },
              { value: 'numeric', label: 'By number' },
              { value: 'numeric-desc', label: 'By number, descending' },
              { value: 'length', label: 'Shortest first' },
              { value: 'length-desc', label: 'Longest first' },
              { value: 'reverse', label: 'Reverse order' },
              { value: 'shuffle', label: 'Shuffle (random)' },
            ]}
            onChange={(sort) => {
              setOpts({ sort });
            }}
          />
          <SelectOption
            label="Duplicates"
            value={opts.dedupe}
            width={190}
            options={[
              { value: 'none', label: 'Keep' },
              { value: 'exact', label: 'Remove (exact)' },
              { value: 'ignore-case', label: 'Remove (ignore case)' },
              { value: 'ignore-whitespace', label: 'Remove (ignore spaces)' },
            ]}
            onChange={(dedupe) => {
              setOpts({ dedupe });
            }}
          />
          {opts.dedupe !== 'none' && (
            <SwitchOption
              label="Drop every repeated line"
              checked={opts.onlyUnique}
              onChange={(onlyUnique) => {
                setOpts({ onlyUnique });
              }}
            />
          )}
          <SelectOption
            label="Trim"
            value={opts.trim}
            width={130}
            options={[
              { value: 'none', label: 'No' },
              { value: 'both', label: 'Both ends' },
              { value: 'start', label: 'Start' },
              { value: 'end', label: 'End' },
            ]}
            onChange={(trim) => {
              setOpts({ trim });
            }}
          />
          <SwitchOption
            label="Remove empty lines"
            checked={opts.removeEmpty}
            onChange={(removeEmpty) => {
              setOpts({ removeEmpty });
            }}
          />
          <SwitchOption
            label="Collapse spaces"
            checked={opts.collapseSpaces}
            onChange={(collapseSpaces) => {
              setOpts({ collapseSpaces });
            }}
          />
          <SwitchOption
            label="Case-sensitive sort"
            checked={opts.caseSensitiveSort}
            onChange={(caseSensitiveSort) => {
              setOpts({ caseSensitiveSort });
            }}
          />
          <SelectOption
            label="Filter"
            value={opts.filter}
            width={150}
            options={[
              { value: 'none', label: 'All lines' },
              { value: 'keep', label: 'Keep containing' },
              { value: 'remove', label: 'Remove containing' },
            ]}
            onChange={(filter) => {
              setOpts({ filter });
            }}
          />
          {opts.filter !== 'none' && field('Filter text', 'filterText', 160)}
          {field('Prefix', 'prefix', 110)}
          {field('Suffix', 'suffix', 110)}
          <SwitchOption
            label="Number lines"
            checked={opts.numbering}
            onChange={(numbering) => {
              setOpts({ numbering });
            }}
          />
        </OptionsBar>
      }
      input={<TextInput field="text" title="Lines" sample={SAMPLE_TEXT} />}
      output={
        <TransformOutput
          toolId="text.line-tools"
          label="Line tools"
          state={state}
          text={r?.text}
          input={raw}
          historyOptions={opts}
          onUseAsInput={(t) => {
            set({ text: t });
          }}
          meta={
            r ? (
              <>
                <CountChip
                  label={`${r.inputLines.toLocaleString()} → ${r.outputLines.toLocaleString()} lines`}
                />
                {r.duplicatesRemoved > 0 && (
                  <CountChip label={`${r.duplicatesRemoved.toLocaleString()} duplicates removed`} />
                )}
                {r.emptyRemoved > 0 && (
                  <CountChip label={`${r.emptyRemoved.toLocaleString()} empty removed`} />
                )}
                {r.filteredOut > 0 && (
                  <CountChip label={`${r.filteredOut.toLocaleString()} filtered out`} />
                )}
              </>
            ) : undefined
          }
        />
      }
    />
  );
}
