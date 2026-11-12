import { normalizeSql, type SqlCompareOptions } from './compare';
import type { SqlDialect } from './dialects';
import { formatSql, type SqlFormatOptions } from './format';
import { parseTables } from './schema';
import { minifySql, type MinifyOptions } from './tokenize';
import {
  tablesToCSharp,
  tablesToTypeScript,
  type SqlCSharpOptions,
  type SqlTypeScriptOptions,
} from './toCode';
import { validateSql } from './validate';

/**
 * SQL operations (pure; main thread or the SQL worker). Some are async because the dialect's
 * parser is loaded on demand.
 */
export const sqlOperations = {
  format: (p: { text: string; dialect: SqlDialect; options: Partial<SqlFormatOptions> }) =>
    formatSql(p.text, p.dialect, p.options),
  minify: (p: { text: string; dialect: SqlDialect; options: Partial<MinifyOptions> }) =>
    minifySql(p.text, p.dialect, p.options),
  validate: (p: { text: string; dialect: SqlDialect }) => validateSql(p.text, p.dialect),
  tables: (p: { text: string; dialect: SqlDialect }) => parseTables(p.text, p.dialect),
  compare: (p: {
    left: string;
    right: string;
    dialect: SqlDialect;
    options: Partial<SqlCompareOptions>;
  }) => {
    const side = (text: string, source: string) => {
      try {
        return normalizeSql(text, p.dialect, p.options);
      } catch (error) {
        if (error instanceof Error) error.message = `${source}: ${error.message}`;
        throw error;
      }
    };
    return { left: side(p.left, 'Original'), right: side(p.right, 'Modified') };
  },
  toCSharp: (p: { text: string; dialect: SqlDialect; options: SqlCSharpOptions }) =>
    tablesToCSharp(parseTables(p.text, p.dialect), p.options),
  toTypeScript: (p: { text: string; dialect: SqlDialect; options: SqlTypeScriptOptions }) =>
    tablesToTypeScript(parseTables(p.text, p.dialect), p.options),
} as const;

export type SqlOperations = typeof sqlOperations;
export type SqlOperationName = keyof SqlOperations;
export type SqlOperationInput<K extends SqlOperationName> = Parameters<SqlOperations[K]>[0];
export type SqlOperationOutput<K extends SqlOperationName> = Awaited<ReturnType<SqlOperations[K]>>;
