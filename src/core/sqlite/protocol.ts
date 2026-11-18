/** Messages between the SQLite Playground and its worker (the database lives in the worker). */

export const MAX_RESULT_ROWS = 5_000;

export type SqliteCell = string | number | null;

export interface SqliteResult {
  /** The statement, as SQLite saw it. */
  sql: string;
  columns: string[];
  rows: SqliteCell[][];
  /** Rows the statement returned (rows beyond MAX_RESULT_ROWS are counted, not kept). */
  totalRows: number;
  rowsModified: number;
  durationMs: number;
}

export interface SqliteRun {
  results: SqliteResult[];
  /** Statements that ran successfully before an error (or all of them). */
  executed: number;
  error: { message: string; statement: string } | null;
  durationMs: number;
}

export interface SqliteColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
}

export interface SqliteObject {
  name: string;
  type: 'table' | 'view';
  columns: SqliteColumnInfo[];
  rows: number | null;
}

export type SqliteRequest =
  | { id: number; type: 'open'; bytes: Uint8Array | null }
  | { id: number; type: 'exec'; sql: string }
  | { id: number; type: 'export' }
  | { id: number; type: 'schema' };

export type SqliteResponse =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; message: string };
