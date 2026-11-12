import { type TextOperations, textOperations } from '@/core/text/operations';
import { JSON_WORKER_THRESHOLD } from './jsonTasks';
import { createTaskRunner } from './taskRunner';

export const textTasks = createTaskRunner<TextOperations>({
  ops: textOperations,
  createWorker: () =>
    new Worker(new URL('../../workers/text.worker.ts', import.meta.url), {
      type: 'module',
      name: 'devstudio-text',
    }),
  workerThreshold: JSON_WORKER_THRESHOLD,
});

/** Regular expressions supplied by the user always run in a worker with this time limit. */
export const REGEX_TIMEOUT_MS = 5_000;
