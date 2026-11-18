import { type SqlOperations, sqlOperations } from '@/core/sql/operations';
import { JSON_WORKER_THRESHOLD } from './jsonTasks';
import { createTaskRunner } from './taskRunner';

export const sqlTasks = createTaskRunner<SqlOperations>({
  ops: sqlOperations,
  createWorker: () =>
    new Worker(new URL('../../workers/sql.worker.ts', import.meta.url), {
      type: 'module',
      name: 'devstudio-sql',
    }),
  workerThreshold: JSON_WORKER_THRESHOLD,
});
