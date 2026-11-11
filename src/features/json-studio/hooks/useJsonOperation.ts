import type {
  JsonOperationInput,
  JsonOperationName,
  JsonOperationOutput,
} from '@/core/json/operations';
import { type OperationState, useTaskOperation } from '@/hooks/useTaskOperation';
import { jsonTasks } from '@/services/workers/jsonTasks';

export { parseErrorFor } from '@/hooks/useTaskOperation';

/** JSON Studio operations (main thread for small inputs, Web Worker for large ones). */
export function useJsonOperation<K extends JsonOperationName>(
  op: K,
  payload: JsonOperationInput<K> | null,
  options: { auto?: boolean } = {},
): OperationState<JsonOperationOutput<K>> {
  return useTaskOperation<JsonOperationInput<K>, JsonOperationOutput<K>>(
    `json.${op}`,
    (p, o) => jsonTasks.run(op, p, o),
    payload,
    options,
  );
}
