import { AppError } from '@/core/errors/AppError';
import { createSqliteEngine, type SqliteEngine } from './engine';
import type {
  SqliteObject,
  SqliteRequest,
  SqliteResponse,
  SqliteRun,
} from '@/core/sqlite/protocol';

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
type RequestBody = SqliteRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, 'id'>
    : never
  : never;

/**
 * Client of the SQLite worker. The worker owns the database; `stop()` terminates it (the only way
 * to interrupt a running query) and reopens the last snapshot (opened file or last save).
 */
export interface SqliteConnection {
  open(bytes: Uint8Array | null): Promise<void>;
  exec(sql: string): Promise<SqliteRun>;
  schema(): Promise<SqliteObject[]>;
  export(): Promise<Uint8Array>;
  /** Interrupts a running query and reopens the last snapshot. */
  stop(): Promise<void>;
  /** False when queries run in process and cannot be interrupted. */
  readonly canStop: boolean;
  dispose(): void;
}

export class SqliteClient implements SqliteConnection {
  readonly canStop = true;
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private snapshot: Uint8Array | null = null;
  private readonly createWorker: () => Worker;

  constructor(createWorker: () => Worker) {
    this.createWorker = createWorker;
  }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = this.createWorker();
    w.onmessage = (event: MessageEvent<SqliteResponse>) => {
      const p = this.pending.get(event.data.id);
      if (!p) return;
      this.pending.delete(event.data.id);
      if (event.data.ok) p.resolve(event.data.result);
      else p.reject(new AppError('UNKNOWN', event.data.message));
    };
    w.onerror = (event) => {
      event.preventDefault();
      this.fail(new AppError('WORKER', 'The SQLite engine could not start in this browser.'));
    };
    this.worker = w;
    return w;
  }

  private fail(error: AppError) {
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private request<T>(body: RequestBody): Promise<T> {
    const id = this.nextId++;
    const worker = this.ensure();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => {
          resolve(v as T);
        },
        reject,
      });
      worker.postMessage({ ...body, id });
    });
  }

  /** Opens a database file (or a new empty database) and remembers it as the snapshot. */
  async open(bytes: Uint8Array | null): Promise<void> {
    this.snapshot = bytes ? bytes.slice() : null;
    await this.request({ type: 'open', bytes });
  }

  exec(sql: string): Promise<SqliteRun> {
    return this.request<SqliteRun>({ type: 'exec', sql });
  }

  schema(): Promise<SqliteObject[]> {
    return this.request<SqliteObject[]>({ type: 'schema' });
  }

  /** The current database file; also becomes the snapshot restored by `stop()`. */
  async export(): Promise<Uint8Array> {
    const bytes = await this.request<Uint8Array>({ type: 'export' });
    this.snapshot = bytes.slice();
    return bytes;
  }

  /** Stops whatever is running and reopens the last snapshot. */
  async stop(): Promise<void> {
    this.fail(new AppError('TIMEOUT', 'The query was stopped.'));
    await this.request({ type: 'open', bytes: this.snapshot });
  }

  dispose(): void {
    this.fail(new AppError('WORKER', 'The SQLite engine was closed.'));
  }
}

/** In-process connection (no worker): used when workers are unavailable, and in tests. */
export class InlineSqliteConnection implements SqliteConnection {
  readonly canStop = false;
  private readonly engine: SqliteEngine;
  private snapshot: Uint8Array | null = null;
  constructor(engine: SqliteEngine) {
    this.engine = engine;
  }
  async open(bytes: Uint8Array | null): Promise<void> {
    this.snapshot = bytes ? bytes.slice() : null;
    await this.engine.open(bytes);
  }
  exec(sql: string): Promise<SqliteRun> {
    return this.engine.exec(sql);
  }
  schema(): Promise<SqliteObject[]> {
    return this.engine.schema();
  }
  async export(): Promise<Uint8Array> {
    const bytes = await this.engine.export();
    this.snapshot = bytes.slice();
    return bytes;
  }
  async stop(): Promise<void> {
    await this.engine.open(this.snapshot);
  }
  dispose(): void {
    /* nothing to release */
  }
}

/** A worker-backed connection, or an in-process one where workers are unavailable. */
export function createSqliteConnection(): SqliteConnection {
  if (typeof Worker === 'undefined') {
    return new InlineSqliteConnection(
      createSqliteEngine(async () => {
        const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
          import('sql.js'),
          import('sql.js/dist/sql-wasm.wasm?url'),
        ]);
        return initSqlJs({ locateFile: () => wasmUrl });
      }),
    );
  }
  return new SqliteClient(
    () =>
      new Worker(new URL('../../workers/sqlite.worker.ts', import.meta.url), {
        type: 'module',
        name: 'devstudio-sqlite',
      }),
  );
}
