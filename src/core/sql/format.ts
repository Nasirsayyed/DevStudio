import { formatDialect, mysql, postgresql, sqlite, transactsql } from 'sql-formatter';
import { ParseError, ValidationError } from '../errors/AppError';
import type { SqlDialect } from './dialects';

export interface SqlFormatOptions {
  indent: 2 | 4 | 'tab';
  keywordCase: 'upper' | 'lower' | 'preserve';
  dataTypeCase: 'upper' | 'lower' | 'preserve';
  functionCase: 'upper' | 'lower' | 'preserve';
  /** "standard" or aligned keyword columns. */
  indentStyle: 'standard' | 'tabularLeft' | 'tabularRight';
  logicalOperatorNewline: 'before' | 'after';
  /** Keep short parenthesized expressions on one line up to this width. */
  expressionWidth: number;
  linesBetweenQueries: number;
  denseOperators: boolean;
  newlineBeforeSemicolon: boolean;
}

export const DEFAULT_SQL_FORMAT: SqlFormatOptions = {
  indent: 2,
  keywordCase: 'upper',
  dataTypeCase: 'upper',
  functionCase: 'upper',
  indentStyle: 'standard',
  logicalOperatorNewline: 'before',
  expressionWidth: 50,
  linesBetweenQueries: 1,
  denseOperators: false,
  newlineBeforeSemicolon: false,
};

const FORMATTER_DIALECT = { mssql: transactsql, postgresql, mysql, sqlite } as const;

/** Formats SQL; tokenizer errors become a ParseError with the line and column. */
export function formatSql(
  sql: string,
  dialect: SqlDialect,
  options: Partial<SqlFormatOptions> = {},
): string {
  if (!sql.trim()) throw new ValidationError('The SQL input is empty.');
  const o = { ...DEFAULT_SQL_FORMAT, ...options };
  try {
    return `${formatDialect(sql, {
      dialect: FORMATTER_DIALECT[dialect],
      tabWidth: o.indent === 'tab' ? 2 : o.indent,
      useTabs: o.indent === 'tab',
      keywordCase: o.keywordCase,
      dataTypeCase: o.dataTypeCase,
      functionCase: o.functionCase,
      indentStyle: o.indentStyle,
      logicalOperatorNewline: o.logicalOperatorNewline,
      expressionWidth: o.expressionWidth,
      linesBetweenQueries: o.linesBetweenQueries,
      denseOperators: o.denseOperators,
      newlineBeforeSemicolon: o.newlineBeforeSemicolon,
    })}\n`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const pos = /at line (\d+) column (\d+)/.exec(message);
    const unexpected = /Unexpected "([^"]*)"/.exec(message)?.[1];
    const friendly = unexpected
      ? `Could not format: unexpected "${unexpected}"`
      : /EOF/.test(message)
        ? 'Could not format: the SQL ends unexpectedly (unclosed parenthesis or quote?)'
        : 'Could not format this SQL';
    const line = pos ? Number(pos[1]) : undefined;
    const column = pos ? Number(pos[2]) : undefined;
    throw new ParseError(
      `${friendly}${line !== undefined ? ` (line ${String(line)}, column ${String(column ?? 1)})` : ''}.`,
      { ...(line !== undefined ? { line } : {}), ...(column !== undefined ? { column } : {}) },
      error,
    );
  }
}
