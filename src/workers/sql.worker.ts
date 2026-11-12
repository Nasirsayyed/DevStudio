/// <reference lib="webworker" />
import { sqlOperations } from '@/core/sql/operations';
import { type TaskRequest, handleTaskRequest } from '@/core/tasks/protocol';

/** SQL tools background worker (formatting, parsing and code generation of large scripts). */
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<TaskRequest>) => {
  void handleTaskRequest(sqlOperations, event.data).then((response) => {
    scope.postMessage(response);
  });
};
