/// <reference lib="webworker" />
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { SqliteRequest, SqliteResponse } from '@/core/sqlite/protocol';
import { createSqliteEngine } from '@/services/sqlite/engine';

/**
 * SQLite (sql.js, WebAssembly) running in its own worker. The database stays open between
 * runs; the page can terminate the worker to stop a runaway query.
 */
const scope = self as unknown as DedicatedWorkerGlobalScope;
const engine = createSqliteEngine(() => initSqlJs({ locateFile: () => wasmUrl }));

scope.onmessage = (event: MessageEvent<SqliteRequest>) => {
  const req = event.data;
  const run = async (): Promise<unknown> => {
    switch (req.type) {
      case 'open':
        return engine.open(req.bytes);
      case 'exec':
        return engine.exec(req.sql);
      case 'schema':
        return engine.schema();
      case 'export':
        return engine.export();
    }
  };
  run()
    .then((result) => {
      const response: SqliteResponse = { id: req.id, ok: true, result };
      if (result instanceof Uint8Array) scope.postMessage(response, [result.buffer]);
      else scope.postMessage(response);
    })
    .catch((error: unknown) => {
      const response: SqliteResponse = {
        id: req.id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
      scope.postMessage(response);
    });
};
