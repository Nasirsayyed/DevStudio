import { useEffect } from 'react';
import type {
  TextOperationInput,
  TextOperationName,
  TextOperationOutput,
} from '@/core/text/operations';
import { type OperationState, useTaskOperation } from '@/hooks/useTaskOperation';
import { textTasks } from '@/services/workers/textTasks';
import { hydrateTextWorkspaceDraft } from '@/stores/textWorkspaceStore';

/**
 * Text operations: main thread for small inputs, Web Worker for large ones. `preferWorker` and
 * `timeoutMs` protect the UI from user-supplied regular expressions.
 */
export function useTextOperation<K extends TextOperationName>(
  op: K,
  payload: TextOperationInput<K> | null,
  runOptions: { preferWorker?: boolean; timeoutMs?: number } = {},
): OperationState<TextOperationOutput<K>> {
  const { preferWorker, timeoutMs } = runOptions;
  return useTaskOperation<TextOperationInput<K>, TextOperationOutput<K>>(
    `text.${op}`,
    (p, o) =>
      textTasks.run(op, p, {
        ...o,
        ...(preferWorker ? { preferWorker } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      }),
    payload,
  );
}

/** Restores the Text Tools draft (once per session). */
export function useTextDraft(): void {
  useEffect(() => {
    void hydrateTextWorkspaceDraft();
  }, []);
}
