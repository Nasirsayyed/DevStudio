import type { SqlDialect } from '@/types/entities';

export type { SqlDialect };

export interface DialectInfo {
  id: SqlDialect;
  label: string;
  /** node-sql-parser "database" option. */
  parser: 'transactsql' | 'postgresql' | 'mysql' | 'sqlite';
  quote: (identifier: string) => string;
  /** Batch separator lines (T-SQL "GO"). */
  batchSeparator: RegExp | null;
}

const doubleQuote = (s: string) => `"${s.replace(/"/g, '""')}"`;

export const DIALECTS: Record<SqlDialect, DialectInfo> = {
  mssql: {
    id: 'mssql',
    label: 'SQL Server (T-SQL)',
    parser: 'transactsql',
    quote: (s) => `[${s.replace(/]/g, ']]')}]`,
    batchSeparator: /^\s*GO\s*(?:--.*)?$/i,
  },
  postgresql: {
    id: 'postgresql',
    label: 'PostgreSQL',
    parser: 'postgresql',
    quote: doubleQuote,
    batchSeparator: null,
  },
  mysql: {
    id: 'mysql',
    label: 'MySQL / MariaDB',
    parser: 'mysql',
    quote: (s) => `\`${s.replace(/`/g, '``')}\``,
    batchSeparator: null,
  },
  sqlite: {
    id: 'sqlite',
    label: 'SQLite',
    parser: 'sqlite',
    quote: doubleQuote,
    batchSeparator: null,
  },
};

export const DIALECT_OPTIONS = Object.values(DIALECTS).map((d) => ({
  value: d.id,
  label: d.label,
}));

const PLAIN_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set(
  'add all alter and any as asc between by case check column constraint create cross current_date current_time current_timestamp database default delete desc distinct drop else end exists foreign from full group having in index inner insert into is join key left like limit not null offset on or order outer primary references right rows select set table then to top union unique update user using values view when where with'.split(
    ' ',
  ),
);

/** Quotes an identifier only when needed (reserved word, spaces, mixed characters). */
export function quoteIdentifier(name: string, dialect: SqlDialect, always = false): string {
  const needs = always || !PLAIN_IDENTIFIER.test(name) || RESERVED.has(name.toLowerCase());
  return needs ? DIALECTS[dialect].quote(name) : name;
}

/** "dbo.Orders" → quoted per part. */
export function qualifiedName(
  name: string,
  schema: string | null,
  dialect: SqlDialect,
  always = false,
): string {
  return schema
    ? `${quoteIdentifier(schema, dialect, always)}.${quoteIdentifier(name, dialect, always)}`
    : quoteIdentifier(name, dialect, always);
}
