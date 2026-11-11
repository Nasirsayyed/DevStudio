import { type ReactNode, useCallback } from 'react';
import { SplitPane, ToolWorkspace } from '@/components';
import type { FileRules } from '@/core/files/fileValidation';
import type {
  JsonOperationInput,
  JsonOperationName,
  JsonOperationOutput,
} from '@/core/json/operations';
import { requireTool } from '@/tools/toolRegistry';
import { useHistoryRecorder } from '../hooks/useHistoryRecorder';
import { parseErrorFor, useJsonOperation } from '../hooks/useJsonOperation';
import { useDocumentFromUrl } from '../hooks/useDocumentFromUrl';
import { useJsonStudioStore } from '../store';
import { JsonInputPanel } from './JsonInputPanel';
import { OutputPanel } from './OutputPanel';

export interface TransformLayoutProps<K extends JsonOperationName> {
  toolId: string;
  op: K;
  /** Memoized payload; null when there is nothing to process. */
  payload: JsonOperationInput<K> | null;
  getOutput: (result: JsonOperationOutput<K>) => string;
  toolbar?: ReactNode;
  outputLanguage?: string;
  outputFilename: string;
  outputMime?: string;
  outputMeta?: (result: JsonOperationOutput<K>) => ReactNode;
  outputWarnings?: (result: JsonOperationOutput<K>) => ReactNode;
  /** Options recorded in history with copy/download. */
  historyOptions?: Record<string, unknown>;
  sample?: string;
  /** Input source: the shared JSON document (default) or the CSV input. */
  inputKind?: 'json' | 'csv';
  inputRules?: FileRules;
  /** Offer "use output as input" (only when output is JSON). */
  canReuseOutput?: boolean;
}

/** Standard input → output layout used by the text-transforming JSON tools. */
export function TransformLayout<K extends JsonOperationName>({
  toolId,
  op,
  payload,
  getOutput,
  toolbar,
  outputLanguage = 'json',
  outputFilename,
  outputMime,
  outputMeta,
  outputWarnings,
  historyOptions,
  sample,
  inputKind = 'json',
  inputRules,
  canReuseOutput = true,
}: TransformLayoutProps<K>) {
  const tool = requireTool(toolId);
  useDocumentFromUrl();
  const json = useJsonStudioStore((s) => s.input);
  const csv = useJsonStudioStore((s) => s.csv);
  const setJson = useJsonStudioStore((s) => s.setInput);
  const setCsv = useJsonStudioStore((s) => s.setCsv);
  const loadDocument = useJsonStudioStore((s) => s.loadDocument);
  const input = inputKind === 'csv' ? csv : json;
  const state = useJsonOperation(op, payload);
  const record = useHistoryRecorder(toolId);
  const output = state.result !== undefined ? getOutput(state.result) : undefined;

  const onExported = useCallback(
    (kind: 'copy' | 'download') => {
      if (output !== undefined) record(`${tool.title} (${kind})`, input, output, historyOptions);
    },
    [output, record, tool.title, input, historyOptions],
  );

  return (
    <ToolWorkspace tool={tool} toolbar={toolbar}>
      <SplitPane
        storageKey={toolId}
        first={
          <JsonInputPanel
            value={input}
            onChange={inputKind === 'csv' ? setCsv : setJson}
            error={inputKind === 'json' ? parseErrorFor(state.error) : null}
            valid={state.status === 'success'}
            language={inputKind === 'csv' ? 'plaintext' : 'json'}
            rules={inputRules}
            sample={sample}
            documents={inputKind === 'json'}
            onRun={state.run}
          />
        }
        second={
          <OutputPanel
            state={state}
            text={output}
            language={outputLanguage}
            filename={outputFilename}
            mimeType={outputMime}
            onExported={onExported}
            onUseAsInput={
              canReuseOutput && inputKind === 'json'
                ? (text) => {
                    loadDocument(text, null);
                  }
                : undefined
            }
            meta={
              state.result !== undefined && state.status === 'success'
                ? outputMeta?.(state.result)
                : undefined
            }
            warnings={
              state.result !== undefined && state.status === 'success'
                ? outputWarnings?.(state.result)
                : undefined
            }
          />
        }
      />
    </ToolWorkspace>
  );
}
