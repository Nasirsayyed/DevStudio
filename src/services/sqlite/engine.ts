import type { Database, SqlJsStatic } from 'sql.js';
import {
  MAX_RESULT_ROWS,
  type SqliteCell,
  type SqliteObject,
  type SqliteResult,
  type SqliteRun,
} from '@/core/sqlite/protocol';

export interface SqliteEngine {
  open(bytes: Uint8Array | null): Promise<true>;
  exec(sql: string): Promise<SqliteRun>;
  schema(): Promise<SqliteObject[]>;
  export(): Promise<Uint8Array>;
}

/**
 * The SQLite Playground's database operations (sql.js). Runs inside the SQLite worker, or in
 * process when workers are unavailable (and in tests).
 */
export function createSqliteEngine(loadSqlJs: () => Promise<SqlJsStatic>): SqliteEngine {
  let engine: Promise<SqlJsStatic> | null = null;
  let db: Database | null = null;

  const load = () => (engine ??= loadSqlJs());

  function firstStatement(rest: string): string {
    const text = rest.trim();
    const end = text.indexOf(';');
    return (end === -1 ? text : text.slice(0, end + 1)).slice(0, 500);
  }

  function cell(v: unknown): SqliteCell {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' || typeof v === 'string') return v;
    if (v instanceof Uint8Array) return `<BLOB ${String(v.byteLength)} bytes>`;
    return typeof v === 'bigint' ? v.toString() : JSON.stringify(v);
  }

  async function open(bytes: Uint8Array | null): Promise<true> {
    const SQL = await load();
    db?.close();
    db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    return true;
  }

  async function database(): Promise<Database> {
    if (!db) await open(null);
    if (!db) throw new Error('The database could not be opened.');
    return db;
  }

  async function exec(sql: string): Promise<SqliteRun> {
    const d = await database();
    const started = performance.now();
    const results: SqliteResult[] = [];
    let executed = 0;
    let current = '';
    let stepping = false;
    const iterator = d.iterateStatements(sql);
    try {
      for (const stmt of iterator) {
        current = stmt.getSQL();
        stepping = true;
        const t0 = performance.now();
        const columns = stmt.getColumnNames();
        const rows: SqliteCell[][] = [];
        let total = 0;
        while (stmt.step()) {
          total += 1;
          if (rows.length < MAX_RESULT_ROWS) rows.push(stmt.get().map(cell));
        }
        const modified = columns.length === 0 ? d.getRowsModified() : 0;
        stmt.free();
        stepping = false;
        executed += 1;
        results.push({
          sql: current,
          columns,
          rows,
          totalRows: total,
          rowsModified: modified,
          durationMs: Math.round(performance.now() - t0),
        });
      }
      return {
        results,
        executed,
        error: null,
        durationMs: Math.round(performance.now() - started),
      };
    } catch (error) {
      return {
        results,
        executed,
        error: {
          message: error instanceof Error ? error.message : String(error),
          // Errors while preparing the next statement happen before it becomes current.
          statement: stepping ? current : firstStatement(iterator.getRemainingSQL()),
        },
        durationMs: Math.round(performance.now() - started),
      };
    }
  }

  async function schema(): Promise<SqliteObject[]> {
    const d = await database();
    const list = d.exec(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
    );
    const objects: SqliteObject[] = [];
    for (const [name, type] of list[0]?.values ?? []) {
      const n = String(name);
      const quoted = `"${n.replace(/"/g, '""')}"`;
      const info = d.exec(`PRAGMA table_info(${quoted})`)[0];
      const columns = (info?.values ?? []).map((r) => ({
        name: String(r[1]),
        type: String(r[2] ?? ''),
        notNull: r[3] === 1,
        primaryKey: Number(r[5]) > 0,
      }));
      let rows: number | null = null;
      if (type === 'table') {
        const count = d.exec(`SELECT COUNT(*) FROM ${quoted}`)[0]?.values[0]?.[0];
        rows = typeof count === 'number' ? count : null;
      }
      objects.push({ name: n, type: type === 'view' ? 'view' : 'table', columns, rows });
    }
    return objects;
  }

  return { open, exec, schema, export: async () => (await database()).export() };
}
