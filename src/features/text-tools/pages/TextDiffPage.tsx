import { Chip, IconButton, Stack, Tooltip } from '@mui/material';
import { ArrowSwapHorizontal } from 'iconsax-reactjs';
import { useMemo } from 'react';
import { CopyButton, EmptyState, Panel } from '@/components';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { OptionsBar, SelectOption, SwitchOption } from '@/components/workspace/OptionControls';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistentOptions } from '@/hooks/usePersistentOptions';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { DiffView } from '../components/DiffView';
import { TextInput } from '../components/TextInput';
import { CompareLayout } from '../components/TextToolLayout';
import { useTextOperation } from '../hooks';
import { SAMPLE_DIFF_LEFT, SAMPLE_DIFF_RIGHT } from '../samples';

interface Options {
  view: 'split' | 'inline';
  highlight: 'word' | 'char' | 'none';
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  collapse: boolean;
  wrap: boolean;
}

export default function TextDiffPage() {
  const [opts, setOpts] = usePersistentOptions<Options>('text.text-diff', {
    view: 'split',
    highlight: 'word',
    ignoreWhitespace: false,
    ignoreCase: false,
    collapse: true,
    wrap: true,
  });
  const left = useTextWorkspaceStore((s) => s.diffLeft);
  const right = useTextWorkspaceStore((s) => s.diffRight);
  const set = useTextWorkspaceStore((s) => s.set);
  const a = useDebouncedValue(left, 200);
  const b = useDebouncedValue(right, 200);
  const payload = useMemo(
    () =>
      a || b
        ? {
            original: a,
            modified: b,
            options: {
              ignoreWhitespace: opts.ignoreWhitespace,
              ignoreCase: opts.ignoreCase,
              inline: opts.highlight,
            },
          }
        : null,
    [a, b, opts.ignoreWhitespace, opts.ignoreCase, opts.highlight],
  );
  const state = useTextOperation('diff', payload);
  const result = state.result;

  return (
    <CompareLayout
      toolId="text.text-diff"
      toolbar={
        <OptionsBar>
          <SelectOption
            label="View"
            value={opts.view}
            options={[
              { value: 'split', label: 'Side by side' },
              { value: 'inline', label: 'Inline' },
            ]}
            onChange={(view) => {
              setOpts({ view });
            }}
          />
          <SelectOption
            label="Highlight"
            value={opts.highlight}
            options={[
              { value: 'word', label: 'Changed words' },
              { value: 'char', label: 'Changed characters' },
              { value: 'none', label: 'Lines only' },
            ]}
            onChange={(highlight) => {
              setOpts({ highlight });
            }}
            width={190}
          />
          <SwitchOption
            label="Ignore whitespace"
            checked={opts.ignoreWhitespace}
            onChange={(ignoreWhitespace) => {
              setOpts({ ignoreWhitespace });
            }}
          />
          <SwitchOption
            label="Ignore case"
            checked={opts.ignoreCase}
            onChange={(ignoreCase) => {
              setOpts({ ignoreCase });
            }}
          />
          <SwitchOption
            label="Collapse unchanged"
            checked={opts.collapse}
            onChange={(collapse) => {
              setOpts({ collapse });
            }}
          />
          <SwitchOption
            label="Wrap lines"
            checked={opts.wrap}
            onChange={(wrap) => {
              setOpts({ wrap });
            }}
          />
        </OptionsBar>
      }
      left={
        <TextInput
          field="diffLeft"
          title="Original"
          sample={SAMPLE_DIFF_LEFT}
          extraActions={
            <Tooltip title="Swap sides">
              <IconButton
                size="small"
                aria-label="Swap sides"
                onClick={() => {
                  set({ diffLeft: right, diffRight: left });
                }}
              >
                <ArrowSwapHorizontal size={18} color="currentColor" />
              </IconButton>
            </Tooltip>
          }
        />
      }
      right={<TextInput field="diffRight" title="Modified" sample={SAMPLE_DIFF_RIGHT} />}
      result={
        <Panel
          title="Differences"
          ariaLabel="Comparison"
          busy={state.status === 'running'}
          meta={
            result && !result.identical ? (
              <Stack direction="row" spacing={0.5}>
                {result.stats.added > 0 && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={`+${String(result.stats.added)}`}
                  />
                )}
                {result.stats.removed > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    variant="outlined"
                    label={`−${String(result.stats.removed)}`}
                  />
                )}
                {result.stats.changed > 0 && (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={`~${String(result.stats.changed)}`}
                  />
                )}
              </Stack>
            ) : undefined
          }
          actions={
            result?.patch ? (
              <>
                <CopyButton label="Copy unified diff" value={result.patch} />
                <DownloadButton
                  content={result.patch}
                  filename="changes.diff"
                  mimeType="text/x-diff"
                  label="Download unified diff"
                />
              </>
            ) : undefined
          }
        >
          <OperationStatusView
            state={state}
            emptyHint="Paste or open two texts above to compare them."
          >
            {(r) =>
              r.identical ? (
                <EmptyState
                  dense
                  title="The texts are identical"
                  description={
                    opts.ignoreWhitespace || opts.ignoreCase
                      ? 'Whitespace and/or case differences were ignored.'
                      : 'No differences found.'
                  }
                />
              ) : (
                <DiffView
                  rows={r.rows}
                  inline={opts.view === 'inline'}
                  collapse={opts.collapse}
                  wrap={opts.wrap}
                />
              )
            }
          </OperationStatusView>
        </Panel>
      }
    />
  );
}
