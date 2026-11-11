/// <reference lib="webworker" />
import { jsonOperations } from '@/core/json/operations';
import { type TaskRequest, handleTaskRequest } from '@/core/tasks/protocol';

/** JSON Studio background worker: runs operations off the main thread. */
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<TaskRequest>) => {
  scope.postMessage(handleTaskRequest(jsonOperations, event.data));
};
