import type { SqlDialect } from './dialects';

/**
 * SQL literals for generated statements. MySQL treats backslash as an escape character by
 * default (unless NO_BACKSLASH_ESCAPES), so backslashes and NUL are escaped there too; otherwise a
 * value such as `\'` could end the string early.
 */
export function sqlStringLiteral(value: string, dialect: SqlDialect): string {
  if (dialect === 'mysql') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/\0/g, '\\0').replace(/'/g, "''");
    return `'${escaped}'`;
  }
  const escaped = value.replace(/'/g, "''");
  // N'…' keeps Unicode text intact in SQL Server (nvarchar).
  return dialect === 'mssql' ? `N'${escaped}'` : `'${escaped}'`;
}

export function sqlBooleanLiteral(value: boolean, dialect: SqlDialect): string {
  if (dialect === 'postgresql' || dialect === 'mysql') return value ? 'TRUE' : 'FALSE';
  return value ? '1' : '0';
}

/** Any JSON-like value: objects and arrays become JSON text. */
export function sqlLiteral(value: unknown, dialect: SqlDialect): string {
  if (value === undefined || value === null) return 'NULL';
  if (typeof value === 'boolean') return sqlBooleanLiteral(value, dialect);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return sqlStringLiteral(value, dialect);
  return sqlStringLiteral(JSON.stringify(value), dialect);
}
