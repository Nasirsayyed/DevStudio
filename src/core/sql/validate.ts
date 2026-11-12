import { ValidationError } from '../errors/AppError';
import { DIALECTS, type SqlDialect } from './dialects';
import { loadSqlParser } from './parser';
import { lineColumn, splitStatements } from './tokenize';

export interface SqlIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** 1-based. */
  line: number;
  column: number;
}

export interface SqlStatementSummary {
  /** "select", "insert", "create table", … */
  type: string;
  tables: string[];
  line: number;
}

export interface SqlValidation {
  valid: boolean;
  statements: SqlStatementSummary[];
  issues: SqlIssue[];
}

export interface PegError {
  message: string;
  location?: { start: { offset: number } };
  found?: string | null;
  expected?: { type: string; text?: string; description?: string }[];
}

const NOISE = new Set(['--', '/*', '#', 'whitespace', '[ \\t\\n\\r]', 'end of input']);

/** Turns a PEG parser error into a short sentence. */
export function describeSyntaxError(e: PegError): string {
  const found =
    e.found === null ? 'the end of the statement' : e.found !== undefined ? `"${e.found}"` : null;
  const expected = [
    ...new Set(
      (e.expected ?? [])
        .map((x) => (x.type === 'literal' ? (x.text ?? '') : (x.description ?? '')))
        .filter((x) => x && !NOISE.has(x) && !x.startsWith('[')),
    ),
  ].slice(0, 6);
  if (found)
    return `Unexpected ${found}${expected.length ? `; expected ${expected.join(', ')}` : ''}.`;
  return e.message.split('\n')[0] ?? 'Syntax error.';
}

type AstNode = Record<string, unknown> & { type?: unknown; keyword?: unknown };

function statementType(ast: AstNode): string {
  const type = typeof ast.type === 'string' ? ast.type : 'statement';
  return type === 'create' || type === 'drop' || type === 'alter'
    ? `${type} ${typeof ast.keyword === 'string' ? ast.keyword : ''}`.trim()
    : type;
}

function lint(ast: AstNode, push: (severity: SqlIssue['severity'], message: string) => void) {
  const type = ast.type;
  if ((type === 'update' || type === 'delete') && !ast.where)
    push('warning', `${type.toUpperCase()} without WHERE changes every row of the table.`);
  if (type === 'select' && Array.isArray(ast.columns)) {
    const star = (ast.columns as { expr?: { column?: unknown } }[]).some(
      (c) =>
        c.expr?.column === '*' ||
        (c.expr?.column as { expr?: { value?: unknown } } | undefined)?.expr?.value === '*',
    );
    if (star)
      push(
        'info',
        'SELECT * returns every column; listing the columns you need is faster and safer.',
      );
  }
  if (
    type === 'insert' &&
    (ast.columns === null || (Array.isArray(ast.columns) && ast.columns.length === 0))
  )
    push('info', 'INSERT without a column list breaks when the table changes; name the columns.');
}

/**
 * Parses every statement with the dialect's parser and reports syntax errors (with positions)
 * and a few risky patterns. The parser does not know every vendor extension, so an error can
 * also mean "not supported".
 */
export async function validateSql(sql: string, dialect: SqlDialect): Promise<SqlValidation> {
  if (!sql.trim()) throw new ValidationError('The SQL input is empty.');
  const info = DIALECTS[dialect];
  const parser = await loadSqlParser(info.parser);
  const statements: SqlStatementSummary[] = [];
  const issues: SqlIssue[] = [];
  for (const st of splitStatements(sql, dialect)) {
    const at = lineColumn(sql, st.offset);
    try {
      const result = parser.parse(st.text, { database: info.parser });
      const asts = (Array.isArray(result.ast) ? result.ast : [result.ast]) as (AstNode | null)[];
      const tables = [
        ...new Set(result.tableList.map((t) => t.split('::').slice(2).join('.')).filter(Boolean)),
      ];
      for (const ast of asts) {
        if (!ast || typeof ast !== 'object') continue;
        statements.push({ type: statementType(ast), tables, line: at.line });
        lint(ast, (severity, message) =>
          issues.push({ severity, message, line: at.line, column: at.column }),
        );
      }
    } catch (error) {
      const e = error as PegError;
      const loc = e.location?.start;
      const pos = loc ? lineColumn(sql, st.offset + loc.offset) : at;
      issues.push({
        severity: 'error',
        message: describeSyntaxError(e),
        line: pos.line,
        column: pos.column,
      });
    }
  }
  return { valid: !issues.some((i) => i.severity === 'error'), statements, issues };
}
