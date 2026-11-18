import type { SqlDialect } from './dialects';
import { DIALECTS } from './dialects';

/** A small SQL lexer: enough to minify safely and split scripts into statements. */

export type SqlTokenKind =
  'string' | 'identifier' | 'comment' | 'whitespace' | 'punctuation' | 'word';

export interface SqlToken {
  kind: SqlTokenKind;
  text: string;
  start: number;
}

export function tokenizeSql(sql: string, dialect: SqlDialect): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;
  const push = (kind: SqlTokenKind, end: number) => {
    tokens.push({ kind, text: sql.slice(i, end), start: i });
    i = end;
  };
  /** End of a quoted run starting at i (doubling the quote escapes it). */
  const quoted = (open: number, close: string, backslash: boolean) => {
    let j = open + 1;
    while (j < sql.length) {
      const c = sql[j];
      if (backslash && c === '\\') j += 2;
      else if (c === close) {
        if (sql[j + 1] === close) j += 2;
        else return j + 1;
      } else j += 1;
    }
    return sql.length;
  };
  while (i < sql.length) {
    const c = sql[i] ?? '';
    const next = sql[i + 1];
    if (/\s/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /\s/.test(sql[j] ?? '')) j += 1;
      push('whitespace', j);
    } else if ((c === '-' && next === '-') || (c === '#' && dialect === 'mysql')) {
      const nl = sql.indexOf('\n', i);
      push('comment', nl === -1 ? sql.length : nl);
    } else if (c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      push('comment', end === -1 ? sql.length : end + 2);
    } else if (c === "'") {
      push('string', quoted(i, "'", dialect === 'mysql'));
    } else if ((c === 'E' || c === 'e') && next === "'" && dialect === 'postgresql') {
      push('string', quoted(i + 1, "'", true));
    } else if ((c === 'N' || c === 'n') && next === "'") {
      push('string', quoted(i + 1, "'", false));
    } else if (c === '"') {
      push(dialect === 'mysql' ? 'string' : 'identifier', quoted(i, '"', dialect === 'mysql'));
    } else if (c === '`' && dialect !== 'mssql') {
      push('identifier', quoted(i, '`', false));
    } else if (c === '[' && dialect === 'mssql') {
      push('identifier', quoted(i, ']', false));
    } else if (c === '$' && dialect === 'postgresql' && /^\$[A-Za-z_]*\$/.test(sql.slice(i))) {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))?.[0] ?? '$$';
      const end = sql.indexOf(tag, i + tag.length);
      push('string', end === -1 ? sql.length : end + tag.length);
    } else if (/[(),;]/.test(c)) {
      push('punctuation', i + 1);
    } else {
      let j = i + 1;
      while (
        j < sql.length &&
        !/[\s(),;'"`[]/.test(sql[j] ?? '') &&
        !(sql[j] === '-' && sql[j + 1] === '-') &&
        !(sql[j] === '/' && sql[j + 1] === '*')
      )
        j += 1;
      push('word', j);
    }
  }
  return tokens;
}

export interface MinifyOptions {
  /** Keep optimizer hints and MySQL version comments (/*+ … *\/, /*! … *\/). */
  keepHints: boolean;
}

/**
 * Removes comments and collapses whitespace outside strings and quoted identifiers. A single
 * space is kept between two tokens that were separated by whitespace or a comment, except before
 * `)` `,` `;` and after `(` `,`.
 */
export function minifySql(
  sql: string,
  dialect: SqlDialect,
  options: Partial<MinifyOptions> = {},
): string {
  const keepHints = options.keepHints ?? true;
  let out = '';
  let separated = false;
  for (const t of tokenizeSql(sql, dialect)) {
    const removable =
      t.kind === 'whitespace' || (t.kind === 'comment' && !(keepHints && /^\/\*[+!]/.test(t.text)));
    if (removable) {
      separated = true;
      continue;
    }
    const last = out.at(-1);
    const tightBefore = t.kind === 'punctuation' && t.text !== '(';
    const tightAfter = last === '(' || last === ',';
    if (out !== '' && separated && !tightBefore && !tightAfter) out += ' ';
    // Line comments end at a newline; a kept hint must not swallow the following code.
    out += t.text;
    separated = false;
  }
  return out;
}

export interface SqlStatement {
  text: string;
  /** Offset of the first character of `text` in the script. */
  offset: number;
}

/** Splits a script on top-level semicolons (and T-SQL "GO" lines); empty statements are dropped. */
export function splitStatements(sql: string, dialect: SqlDialect): SqlStatement[] {
  const separator = DIALECTS[dialect].batchSeparator;
  const out: SqlStatement[] = [];
  let start = 0;
  const flush = (end: number, next: number) => {
    const raw = sql.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    if (raw.trim() && !/^(\s|--[^\n]*|\/\*[\s\S]*?\*\/)*$/.test(raw))
      out.push({ text: raw.trim(), offset: start + lead });
    start = next;
  };
  for (const t of tokenizeSql(sql, dialect)) {
    if (t.kind === 'punctuation' && t.text === ';') flush(t.start, t.start + 1);
    else if (separator && t.kind === 'word' && /^go$/i.test(t.text)) {
      const lineStart = sql.lastIndexOf('\n', t.start - 1) + 1;
      const lineEnd = sql.indexOf('\n', t.start);
      const line = sql.slice(lineStart, lineEnd === -1 ? sql.length : lineEnd);
      if (separator.test(line)) flush(lineStart, lineEnd === -1 ? sql.length : lineEnd);
    }
  }
  flush(sql.length, sql.length);
  return out;
}

/** 1-based line and column of an offset. */
export function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return { line, column: offset - before.lastIndexOf('\n') };
}
