import type { SqlDialect } from './dialects';
import { formatSql } from './format';
import { tokenizeSql } from './tokenize';

export interface SqlCompareOptions {
  stripComments: boolean;
}

/** Strips comments (outside strings) so they do not show up as differences. */
export function stripSqlComments(sql: string, dialect: SqlDialect): string {
  return tokenizeSql(sql, dialect)
    .map((t) =>
      t.kind === 'comment'
        ? t.text.startsWith('--') || t.text.startsWith('#')
          ? ''
          : ' '
        : t.text,
    )
    .join('');
}

/**
 * Normal form for comparing two scripts: same formatting (upper-case keywords, standard
 * indentation), so only real differences remain.
 */
export function normalizeSql(
  sql: string,
  dialect: SqlDialect,
  options: Partial<SqlCompareOptions> = {},
): string {
  const source = options.stripComments === false ? sql : stripSqlComments(sql, dialect);
  return formatSql(source, dialect, {
    keywordCase: 'upper',
    dataTypeCase: 'upper',
    functionCase: 'upper',
    indent: 2,
  });
}
