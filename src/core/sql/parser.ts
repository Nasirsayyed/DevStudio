import type { DialectInfo } from './dialects';

/** Minimal surface of node-sql-parser that DevStudio uses. */
export interface SqlParser {
  astify(sql: string, options: { database: string }): unknown;
  parse(
    sql: string,
    options: { database: string },
  ): { tableList: string[]; columnList: string[]; ast: unknown };
}

const cache = new Map<string, Promise<SqlParser>>();

/**
 * Loads the parser of one dialect on demand (each is a separate ~250 KB chunk), once.
 * Works on the main thread and in workers.
 */
export function loadSqlParser(dialect: DialectInfo['parser']): Promise<SqlParser> {
  let p = cache.get(dialect);
  if (!p) {
    const load =
      dialect === 'transactsql'
        ? import('node-sql-parser/build/transactsql')
        : dialect === 'postgresql'
          ? import('node-sql-parser/build/postgresql')
          : dialect === 'mysql'
            ? import('node-sql-parser/build/mysql')
            : import('node-sql-parser/build/sqlite');
    p = load.then((m) => {
      const mod = m as unknown as {
        Parser?: new () => SqlParser;
        default?: { Parser: new () => SqlParser };
      };
      const Ctor = mod.Parser ?? mod.default?.Parser;
      if (!Ctor) throw new Error('SQL parser failed to load.');
      return new Ctor();
    });
    p.catch(() => cache.delete(dialect));
    cache.set(dialect, p);
  }
  return p;
}
