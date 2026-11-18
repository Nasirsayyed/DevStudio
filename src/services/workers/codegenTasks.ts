import { type CodegenOperations, codegenOperations } from '@/core/codegen/operations';
import { JSON_WORKER_THRESHOLD } from './jsonTasks';
import { createTaskRunner } from './taskRunner';

export const codegenTasks = createTaskRunner<CodegenOperations>({
  ops: codegenOperations,
  createWorker: () =>
    new Worker(new URL('../../workers/codegen.worker.ts', import.meta.url), {
      type: 'module',
      name: 'devstudio-codegen',
    }),
  workerThreshold: JSON_WORKER_THRESHOLD,
});
