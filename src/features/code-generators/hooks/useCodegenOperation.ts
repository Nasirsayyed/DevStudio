import type {
  CodegenOperationInput,
  CodegenOperationName,
  CodegenOperationOutput,
} from '@/core/codegen/operations';
import { type OperationState, useTaskOperation } from '@/hooks/useTaskOperation';
import { codegenTasks } from '@/services/workers/codegenTasks';

/** Code generator operations (main thread for small inputs, Web Worker for large ones). */
export function useCodegenOperation<K extends CodegenOperationName>(
  op: K,
  payload: CodegenOperationInput<K> | null,
): OperationState<CodegenOperationOutput<K>> {
  return useTaskOperation<CodegenOperationInput<K>, CodegenOperationOutput<K>>(
    `codegen.${op}`,
    (p, o) => codegenTasks.run(op, p, o),
    payload,
  );
}
