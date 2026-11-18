import { AppError } from '@/core/errors/AppError';
import { type OperationTable, type TaskResponse, deserializeError } from '@/core/tasks/protocol';

export interface RunOptions {
  signal?: AbortSignal;
  /** Approximate input size in characters; decides main thread vs worker. */
  size?: number;
  /**
   * Run in a worker whatever the size (when workers are available), e.g. for user-supplied
   * regular expressions that could backtrack catastrophically.
   */
  preferWorker?: boolean;
  /** Worker runs only: stop the worker and reject with a TIMEOUT error after this many ms. */
  timeoutMs?: number;
}

export interface TaskRunner<Ops extends OperationTable> {
  run<K extends keyof Ops & string>(
    op: K,
    payload: Parameters<Ops[K]>[0],
    options?: RunOptions,
  ): Promise<Awaited<ReturnType<Ops[K]>>>;
  /** Terminates all workers (e.g. on page unload or in tests). */
  dispose(): void;
}

export interface TaskRunnerConfig<Ops extends OperationTable> {
  ops: Ops;
  /** Creates a worker; omit to always run on the main thread. */
  createWorker?: () => Worker;
  /** Inputs at or above this size (chars) run in a worker. */
  workerThreshold: number;
  maxWorkers?: number;
}

export function abortError(): DOMException {
  return new DOMException('The operation was cancelled.', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface PooledWorker {
  worker: Worker;
  busy: boolean;
}

/**
 * Runs pure operations either synchronously on the main thread (small inputs)
 * or in a pool of dedicated workers (large inputs). Each worker task can be
 * cancelled; cancelling terminates only that task's worker. If workers are
 * unavailable or fail to start (e.g. blocked by policy), tasks fall back to
 * the main thread.
 */
export function createTaskRunner<Ops extends OperationTable>(
  config: TaskRunnerConfig<Ops>,
): TaskRunner<Ops> {
  const { ops, createWorker, workerThreshold, maxWorkers = 2 } = config;
  const pool: PooledWorker[] = [];
  const waiting: ((w: PooledWorker) => void)[] = [];
  let nextId = 1;
  let workersBroken = false;

  const runOnMainThread = async <K extends keyof Ops & string>(
    op: K,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<Ops[K]>>> => {
    // Yield once so the UI can paint a "processing" state first.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (signal?.aborted) throw abortError();
    const fn = ops[op] as (p: unknown) => unknown;
    return (await fn(payload)) as Awaited<ReturnType<Ops[K]>>;
  };

  const acquire = (): Promise<PooledWorker> => {
    const idle = pool.find((p) => !p.busy);
    if (idle) {
      idle.busy = true;
      return Promise.resolve(idle);
    }
    if (pool.length < maxWorkers && createWorker) {
      const pooled = { worker: createWorker(), busy: true };
      pool.push(pooled);
      return Promise.resolve(pooled);
    }
    return new Promise((resolve) => waiting.push(resolve));
  };

  const release = (pooled: PooledWorker) => {
    const next = waiting.shift();
    if (next) next(pooled);
    else pooled.busy = false;
  };

  const discard = (pooled: PooledWorker) => {
    pooled.worker.terminate();
    const i = pool.indexOf(pooled);
    if (i >= 0) pool.splice(i, 1);
    // Let a waiting task create a fresh worker.
    const next = waiting.shift();
    if (next && createWorker) {
      const fresh = { worker: createWorker(), busy: true };
      pool.push(fresh);
      next(fresh);
    }
  };

  const runInWorker = async <K extends keyof Ops & string>(
    op: K,
    payload: unknown,
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<Awaited<ReturnType<Ops[K]>>> => {
    const pooled = await acquire();
    if (signal?.aborted) {
      release(pooled);
      throw abortError();
    }
    const id = nextId++;
    return new Promise<Awaited<ReturnType<Ops[K]>>>((resolve, reject) => {
      const timer =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              cleanup();
              discard(pooled);
              reject(
                new AppError(
                  'TIMEOUT',
                  `The operation took longer than ${String(Math.round(timeoutMs / 1000))} s and was stopped.`,
                ),
              );
            }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        pooled.worker.removeEventListener('message', onMessage);
        pooled.worker.removeEventListener('error', onError);
        signal?.removeEventListener('abort', onAbort);
      };
      const onMessage = (event: MessageEvent<TaskResponse>) => {
        if (event.data.id !== id) return;
        cleanup();
        release(pooled);
        if (event.data.ok) resolve(event.data.result as Awaited<ReturnType<Ops[K]>>);
        else reject(deserializeError(event.data.error));
      };
      const onError = (event: ErrorEvent) => {
        event.preventDefault();
        cleanup();
        discard(pooled);
        workersBroken = true;
        // The worker could not run (load failure / policy): fall back once to the main thread.
        runOnMainThread(op, payload, signal).then(resolve, reject);
      };
      const onAbort = () => {
        cleanup();
        discard(pooled);
        reject(abortError());
      };
      pooled.worker.addEventListener('message', onMessage);
      pooled.worker.addEventListener('error', onError);
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        pooled.worker.postMessage({ id, op, payload });
      } catch (error) {
        cleanup();
        release(pooled);
        reject(
          new AppError('WORKER', 'Could not send data to the background worker.', { cause: error }),
        );
      }
    });
  };

  return {
    run(op, payload, options = {}) {
      const { signal, size = 0, preferWorker = false, timeoutMs } = options;
      if (signal?.aborted) return Promise.reject(abortError());
      const canUseWorker =
        !workersBroken && createWorker !== undefined && typeof Worker !== 'undefined';
      if (canUseWorker && (preferWorker || size >= workerThreshold))
        return runInWorker(op, payload, signal, timeoutMs);
      return runOnMainThread(op, payload, signal);
    },
    dispose() {
      for (const p of pool) p.worker.terminate();
      pool.length = 0;
    },
  };
}
