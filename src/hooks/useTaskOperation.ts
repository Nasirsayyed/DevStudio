import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, ParseError, isAppError } from '@/core/errors/AppError';
import { type RunOptions, isAbortError } from '@/services/workers/taskRunner';

/** Inputs up to this size re-run automatically while typing; larger ones run on demand. */
export const AUTO_RUN_LIMIT = 1_000_000;
const DEBOUNCE_MS = 250;

export type OperationStatus = 'idle' | 'running' | 'success' | 'error';

export interface OperationState<T> {
  status: OperationStatus;
  result: T | undefined;
  error: AppError | null;
  durationMs: number | null;
  /** Input changed since the last run (manual mode for large inputs). */
  stale: boolean;
  autoRun: boolean;
  run: () => void;
}

function payloadSize(payload: unknown): number {
  if (typeof payload === 'string') return payload.length;
  if (payload && typeof payload === 'object') {
    return Object.values(payload).reduce<number>(
      (sum, v) => sum + (typeof v === 'string' ? v.length : 0),
      0,
    );
  }
  return 0;
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError('UNKNOWN', error instanceof Error ? error.message : String(error), {
    cause: error,
  });
}

/**
 * Runs an operation of a task runner (main thread or worker) whenever `payload` changes.
 * `payload` must be memoized by the caller; `null` means "nothing to do".
 * Previous runs are cancelled, and results of stale runs are never shown.
 */
export function useTaskOperation<P, R>(
  /** Stable identifier of the operation (e.g. "json.format"); changing it resets the run. */
  key: string,
  /** Executes the operation, typically `(p, o) => runner.run(op, p, o)`. */
  execute: (payload: P, options: RunOptions) => Promise<R>,
  payload: P | null,
  options: { auto?: boolean } = {},
): OperationState<R> {
  const size = payloadSize(payload);
  const autoRun = (options.auto ?? true) && size <= AUTO_RUN_LIMIT;
  const [state, setState] = useState<{
    status: OperationStatus;
    result: R | undefined;
    error: AppError | null;
    durationMs: number | null;
    ranPayload: unknown;
  }>({ status: 'idle', result: undefined, error: null, durationMs: null, ranPayload: null });
  const controllerRef = useRef<AbortController | null>(null);
  const payloadRef = useRef(payload);
  const executeRef = useRef(execute);
  useEffect(() => {
    payloadRef.current = payload;
    executeRef.current = execute;
  });

  const run = useCallback(() => {
    const current = payloadRef.current;
    controllerRef.current?.abort();
    if (current === null) {
      setState({
        status: 'idle',
        result: undefined,
        error: null,
        durationMs: null,
        ranPayload: null,
      });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, status: 'running', ranPayload: current }));
    const started = performance.now();
    executeRef
      .current(current, { signal: controller.signal, size: payloadSize(current) })
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'success',
          result,
          error: null,
          durationMs: Math.round(performance.now() - started),
          ranPayload: current,
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || controller.signal.aborted) return;
        setState({
          status: 'error',
          result: undefined,
          error: toAppError(error),
          durationMs: null,
          ranPayload: current,
        });
      });
    // `key` identifies the operation; the latest execute function is read from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (payload === null) {
      controllerRef.current?.abort();
      return undefined;
    }
    if (!autoRun) return undefined;
    const handle = window.setTimeout(run, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [payload, autoRun, run]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  if (payload === null) {
    return {
      status: 'idle',
      result: undefined,
      error: null,
      durationMs: null,
      stale: false,
      autoRun,
      run,
    };
  }
  return {
    status: state.status,
    result: state.result,
    error: state.error,
    durationMs: state.durationMs,
    stale: state.ranPayload !== payload,
    autoRun,
    run,
  };
}

/** Editor marker info for a parse error coming from a given input source. */
export function parseErrorFor(error: AppError | null, source?: string): ParseError | null {
  if (!(error instanceof ParseError) || error.line === undefined) return null;
  if (source !== undefined && error.source !== undefined && error.source !== source) return null;
  return error;
}
