import { AppError, type AppErrorCode, ParseError, ValidationError } from '../errors/AppError';

/** Message protocol between the main thread and task workers. */
export interface TaskRequest {
  id: number;
  op: string;
  payload: unknown;
}

export interface SerializedError {
  name: string;
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type TaskResponse =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: SerializedError };

export type OperationTable = Record<string, (payload: never) => unknown>;

export function serializeError(error: unknown): SerializedError {
  if (error instanceof AppError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }
  if (error instanceof Error) return { name: error.name, code: 'UNKNOWN', message: error.message };
  return { name: 'Error', code: 'UNKNOWN', message: String(error) };
}

/** Rebuilds a typed AppError on the receiving side so `instanceof` checks keep working. */
export function deserializeError(e: SerializedError): AppError {
  if (e.name === 'ParseError' || e.code === 'PARSE') {
    const line = typeof e.details?.line === 'number' ? e.details.line : undefined;
    const column = typeof e.details?.column === 'number' ? e.details.column : undefined;
    const source = typeof e.details?.source === 'string' ? e.details.source : undefined;
    return new ParseError(e.message, {
      ...(line !== undefined ? { line } : {}),
      ...(column !== undefined ? { column } : {}),
      ...(source !== undefined ? { source } : {}),
    });
  }
  if (e.name === 'ValidationError' || e.code === 'VALIDATION')
    return new ValidationError(e.message);
  return new AppError(e.code, e.message, e.details ? { details: e.details } : {});
}

/**
 * Executes a request against an operation table (used inside workers and in tests). Operations
 * may be synchronous or return a promise (e.g. when they load a parser on demand).
 */
export async function handleTaskRequest(
  ops: OperationTable,
  request: TaskRequest,
): Promise<TaskResponse> {
  const fn = Object.prototype.hasOwnProperty.call(ops, request.op) ? ops[request.op] : undefined;
  if (!fn)
    return {
      id: request.id,
      ok: false,
      error: { name: 'Error', code: 'UNKNOWN', message: `Unknown operation: ${request.op}` },
    };
  try {
    return { id: request.id, ok: true, result: await fn(request.payload as never) };
  } catch (error) {
    return { id: request.id, ok: false, error: serializeError(error) };
  }
}
