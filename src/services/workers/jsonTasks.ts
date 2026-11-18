import { type JsonOperations, jsonOperations } from '@/core/json/operations';
import { createTaskRunner } from './taskRunner';

/** Inputs of ~100 KB and above are processed in a background worker. */
export const JSON_WORKER_THRESHOLD = 100_000;

export const jsonTasks = createTaskRunner<JsonOperations>({
  ops: jsonOperations,
  createWorker: () =>
    new Worker(new URL('../../workers/json.worker.ts', import.meta.url), {
      type: 'module',
      name: 'devstudio-json',
    }),
  workerThreshold: JSON_WORKER_THRESHOLD,
});
