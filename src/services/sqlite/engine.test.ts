import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { MAX_RESULT_ROWS } from '@/core/sqlite/protocol';
import { createSqliteEngine } from './engine';
import { InlineSqliteConnection } from './sqliteClient';

const engine = () => createSqliteEngine(() => initSqlJs());

describe('SQLite engine', () => {
  it('runs scripts statement by statement with results, row counts and timing', async () => {
    const e = engine();
    const run = await e.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, data BLOB);
      INSERT INTO t (name, data) VALUES ('a', x'0102'), ('b', NULL);
      UPDATE t SET name = upper(name);
      SELECT id, name, data FROM t ORDER BY id;`);
    expect(run.error).toBeNull();
    expect(run.executed).toBe(4);
    expect(run.results.map((r) => r.rowsModified)).toEqual([0, 2, 2, 0]);
    expect(run.results[3]).toMatchObject({
      columns: ['id', 'name', 'data'],
      rows: [
        [1, 'A', '<BLOB 2 bytes>'],
        [2, 'B', null],
      ],
      totalRows: 2,
    });
  });

  it('stops at the first error and reports the statement', async () => {
    const e = engine();
    const run = await e.exec('CREATE TABLE a (x INT); INSERT INTO missing VALUES (1); SELECT 1;');
    expect(run.executed).toBe(1);
    expect(run.error?.message).toMatch(/no such table: missing/);
    expect(run.error?.statement).toMatch(/INSERT INTO missing/);
  });

  it('keeps at most MAX_RESULT_ROWS rows but counts them all', async () => {
    const e = engine();
    const run = await e.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${String(MAX_RESULT_ROWS + 10)}) SELECT i FROM n;`,
    );
    expect(run.results[0]?.rows).toHaveLength(MAX_RESULT_ROWS);
    expect(run.results[0]?.totalRows).toBe(MAX_RESULT_ROWS + 10);
  });

  it('lists tables and views with columns and row counts, and enforces foreign keys', async () => {
    const e = engine();
    await e.exec(`CREATE TABLE "my parent" (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INT REFERENCES "my parent"(id));
      CREATE VIEW v AS SELECT name FROM "my parent";
      INSERT INTO "my parent" (name) VALUES ('x');`);
    expect(await e.schema()).toEqual([
      {
        name: 'child',
        type: 'table',
        rows: 0,
        columns: [
          { name: 'id', type: 'INTEGER', notNull: false, primaryKey: true },
          { name: 'parent_id', type: 'INT', notNull: false, primaryKey: false },
        ],
      },
      {
        name: 'my parent',
        type: 'table',
        rows: 1,
        columns: [
          { name: 'id', type: 'INTEGER', notNull: false, primaryKey: true },
          { name: 'name', type: 'TEXT', notNull: true, primaryKey: false },
        ],
      },
      {
        name: 'v',
        type: 'view',
        rows: null,
        columns: [{ name: 'name', type: 'TEXT', notNull: false, primaryKey: false }],
      },
    ]);
    expect((await e.exec('INSERT INTO child (parent_id) VALUES (42);')).error?.message).toMatch(
      /FOREIGN KEY/,
    );
  });

  it('exports a database file that can be reopened, and stop() restores the snapshot', async () => {
    const conn = new InlineSqliteConnection(engine());
    await conn.open(null);
    await conn.exec("CREATE TABLE k (v TEXT); INSERT INTO k VALUES ('saved');");
    const file = await conn.export();
    expect(new TextDecoder().decode(file.slice(0, 15))).toBe('SQLite format 3');
    await conn.exec("INSERT INTO k VALUES ('unsaved');");
    await conn.stop();
    expect((await conn.exec('SELECT v FROM k')).results[0]?.rows).toEqual([['saved']]);
    const other = new InlineSqliteConnection(engine());
    await other.open(file);
    expect((await other.exec('SELECT COUNT(*) FROM k')).results[0]?.rows).toEqual([[1]]);
    await expect(other.open(new TextEncoder().encode('not a database'))).resolves.toBeUndefined();
    expect((await other.exec('SELECT 1')).error?.message).toMatch(/not a database/);
  });
});
