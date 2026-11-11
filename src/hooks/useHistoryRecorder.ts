import { useCallback } from 'react';
import { toolHistoryRepository } from '@/services/db/repositories';

/**
 * Records meaningful operations (copying or downloading a result) in the tool
 * history, so work can be restored later. Best-effort: failures never block the UI.
 */
export function useHistoryRecorder(toolId: string) {
  return useCallback(
    (label: string, input: string, output: string, options: object = {}) => {
      toolHistoryRepository
        .record({
          toolId,
          label,
          input,
          output,
          options: { ...options },
        })
        .catch((error: unknown) => {
          console.warn('Could not record history', error);
        });
    },
    [toolId],
  );
}
