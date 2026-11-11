/// <reference lib="webworker" />
import { codegenOperations } from '@/core/codegen/operations';
import { type TaskRequest, handleTaskRequest } from '@/core/tasks/protocol';

/** Code generators background worker. */
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<TaskRequest>) => {
  scope.postMessage(handleTaskRequest(codegenOperations, event.data));
};
