import { useMemo, useState } from 'react';
import { Panel, SearchInput } from '@/components';
import { JsonViewer } from '@/components/data-display/JsonViewer';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { JsonToolLayout } from '../components/JsonToolLayout';
import { OperationStatusView } from '@/components/workspace/OperationStatusView';
import { parseErrorFor, useJsonOperation } from '../hooks/useJsonOperation';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

export default function JsonTreePage() {
  const input = useJsonWorkspaceStore((s) => s.input);
  const payload = useMemo(() => (input.trim() ? { text: input } : null), [input]);
  const state = useJsonOperation('parse', payload);
  const [highlight, setHighlight] = useState('');
  return (
    <JsonToolLayout
      toolId="json.tree"
      sample={SAMPLE_ORDER_JSON}
      inputError={parseErrorFor(state.error)}
      inputValid={state.status === 'success'}
      onRun={state.run}
    >
      <Panel
        title="Tree"
        busy={state.status === 'running'}
        actions={
          <SearchInput
            value={highlight}
            onChange={setHighlight}
            label="Highlight in tree"
            sx={{ width: 200, my: 0.5 }}
          />
        }
      >
        <OperationStatusView
          state={state}
          emptyHint="Paste, type, drop or open JSON on the left to explore it as a tree."
        >
          {(value) => (
            <JsonViewer
              value={value}
              ariaLabel="JSON tree"
              highlight={highlight}
              defaultExpandDepth={2}
            />
          )}
        </OperationStatusView>
      </Panel>
    </JsonToolLayout>
  );
}
