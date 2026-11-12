/// <reference lib="webworker" />
import { type TaskRequest, handleTaskRequest } from '@/core/tasks/protocol';
import { textOperations } from '@/core/text/operations';

/** Text tools background worker (large inputs and user-supplied regular expressions). */
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<TaskRequest>) => {
  scope.postMessage(handleTaskRequest(textOperations, event.data));
};
