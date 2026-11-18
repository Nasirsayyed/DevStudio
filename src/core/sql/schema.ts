import { ParseError, ValidationError } from '../errors/AppError';
import type { SqlDialect } from './dialects';
import { lineColumn, type SqlToken, tokenizeSql } from './tokenize';

/** Tables described by CREATE TABLE statements (input of the SQL → code generators and CRUD). */

export interface ColumnModel {
  name: string;
  /** Upper-case base type, e.g. "VARCHAR", "NUMERIC", "TIMESTAMPTZ". */
  type: string;
  length: number | null;
  scale: number | null;
  nullable: boolean;
  primaryKey: boolean;
  identity: boolean;
  unique: boolean;
  defaultValue: string | null;
}

export interface ForeignKeyModel {
  columns: string[];
  refTable: string;
  refSchema: string | null;
  refColumns: string[];
  onDelete: string | null;
}

export interface TableModel {
  name: string;
  schema: string | null;
  columns: ColumnModel[];
  primaryKey: string[];
  foreignKeys: ForeignKeyModel[];
}

/* ------------------------------------------------------------------------------------------ */
/* A tolerant CREATE TABLE parser. DDL is regular across dialects, so one token-based parser     */
/* handles SQL Server, PostgreSQL, MySQL and SQLite, and skips vendor options it does not need.  */
/* ------------------------------------------------------------------------------------------ */

type Tok = SqlToken;

const COLUMN_STOP = new Set([
  'NOT',
  'NULL',
  'PRIMARY',
  'UNIQUE',
  'DEFAULT',
  'REFERENCES',
  'CHECK',
  'CONSTRAINT',
  'IDENTITY',
  'AUTO_INCREMENT',
  'AUTOINCREMENT',
  'COLLATE',
  'GENERATED',
  'COMMENT',
  'ON',
  'CHARSET',
  'KEY',
  'AS',
  'ROWGUIDCOL',
  'SPARSE',
  'FILESTREAM',
  'MASKED',
]);
/** Words that can continue a multi-word type name (DOUBLE PRECISION, CHARACTER VARYING…). */
const TYPE_WORDS = new Set([
  'PRECISION',
  'VARYING',
  'WITH',
  'WITHOUT',
  'TIME',
  'ZONE',
  'UNSIGNED',
  'SIGNED',
  'ZEROFILL',
  'LOCAL',
]);

function unquote(text: string): string {
  if (text.startsWith('[') && text.endsWith(']')) return text.slice(1, -1).replace(/]]/g, ']');
  if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1).replace(/""/g, '"');
  if (text.startsWith('`') && text.endsWith('`')) return text.slice(1, -1).replace(/``/g, '`');
  return text;
}

const upper = (t: Tok | undefined) => (t && t.kind === 'word' ? t.text.toUpperCase() : '');
const isPunct = (t: Tok | undefined, p: string) => t?.kind === 'punctuation' && t.text === p;

class DdlParser {
  private i = 0;
  private readonly toks: Tok[];
  private readonly sql: string;
  constructor(sql: string, dialect: SqlDialect) {
    this.sql = sql;
    this.toks = tokenizeSql(sql, dialect).filter(
      (t) => t.kind !== 'whitespace' && t.kind !== 'comment',
    );
  }

  private fail(message: string, tok = this.toks[this.i]): never {
    const pos = lineColumn(this.sql, tok?.start ?? this.sql.length);
    throw new ParseError(
      `${message} (line ${String(pos.line)}, column ${String(pos.column)})`,
      pos,
    );
  }

  /** Reads a possibly qualified name: a.b.c, [a].[b], "a"."b". */
  private name(): string[] {
    const parts: string[] = [];
    for (;;) {
      const t = this.toks[this.i];
      if (!t || (t.kind !== 'word' && t.kind !== 'identifier')) break;
      if (t.kind === 'word') {
        // An unquoted word may contain dots ("dbo.Users") or be a lone "." between quoted parts.
        const chunks = t.text.split('.');
        for (const c of chunks) if (c) parts.push(c);
        this.i += 1;
        if (!t.text.endsWith('.')) {
          if (this.toks[this.i]?.kind === 'word' && this.toks[this.i]?.text.startsWith('.'))
            continue;
          break;
        }
      } else {
        parts.push(unquote(t.text));
        this.i += 1;
        if (!(this.toks[this.i]?.kind === 'word' && this.toks[this.i]?.text.startsWith('.'))) break;
      }
    }
    return parts;
  }

  /** Tokens of a parenthesized group starting at "(", split on top-level commas. */
  private group(): Tok[][] {
    if (!isPunct(this.toks[this.i], '(')) this.fail('Expected "("');
    const open = this.toks[this.i];
    this.i += 1;
    const items: Tok[][] = [[]];
    let depth = 0;
    for (; this.i < this.toks.length; this.i += 1) {
      const t = this.toks[this.i];
      if (!t) break;
      if (isPunct(t, '(')) depth += 1;
      else if (isPunct(t, ')')) {
        if (depth === 0) {
          this.i += 1;
          return items.filter((x) => x.length > 0);
        }
        depth -= 1;
      } else if (isPunct(t, ',') && depth === 0) {
        items.push([]);
        continue;
      }
      items.at(-1)?.push(t);
    }
    return this.fail('Missing ")"', open);
  }

  tables(): TableModel[] {
    const out: TableModel[] = [];
    while (this.i < this.toks.length) {
      if (upper(this.toks[this.i]) !== 'CREATE') {
        this.i += 1;
        continue;
      }
      let j = this.i + 1;
      while (
        ['OR', 'REPLACE', 'GLOBAL', 'LOCAL', 'TEMP', 'TEMPORARY', 'UNLOGGED'].includes(
          upper(this.toks[j]),
        )
      )
        j += 1;
      if (upper(this.toks[j]) !== 'TABLE') {
        this.i += 1;
        continue;
      }
      this.i = j + 1;
      if (upper(this.toks[this.i]) === 'IF') this.i += 3; // IF NOT EXISTS
      const nameTok = this.toks[this.i];
      const parts = this.name();
      if (parts.length === 0) this.fail('Expected a table name', nameTok);
      if (!isPunct(this.toks[this.i], '(')) {
        // CREATE TABLE … AS SELECT / LIKE: no column list to read.
        continue;
      }
      out.push(this.table(parts));
    }
    return out;
  }

  private table(parts: string[]): TableModel {
    const name = parts.at(-1) ?? '';
    const schema = parts.length > 1 ? (parts.at(-2) ?? null) : null;
    const table: TableModel = { name, schema, columns: [], primaryKey: [], foreignKeys: [] };
    for (const item of this.group()) this.item(item, table);
    for (const c of table.columns) {
      if (table.primaryKey.includes(c.name)) {
        c.primaryKey = true;
        c.nullable = false;
      }
    }
    return table;
  }

  private item(toks: Tok[], table: TableModel) {
    let k = 0;
    if (upper(toks[0]) === 'CONSTRAINT') k = 2;
    const head = upper(toks[k]);
    if (
      [
        'PRIMARY',
        'FOREIGN',
        'UNIQUE',
        'CHECK',
        'KEY',
        'INDEX',
        'FULLTEXT',
        'SPATIAL',
        'EXCLUDE',
        'PERIOD',
      ].includes(head)
    ) {
      this.constraint(toks.slice(k), table);
      return;
    }
    this.column(toks, table);
  }

  /** Column names in "( a, b )" starting at index k of toks; returns names and the next index. */
  private columnList(toks: Tok[], k: number): { names: string[]; next: number } {
    const names: string[] = [];
    if (!isPunct(toks[k], '(')) return { names, next: k };
    let i = k + 1;
    let depth = 0;
    for (; i < toks.length; i += 1) {
      const t = toks[i];
      if (!t) break;
      if (isPunct(t, '(')) depth += 1;
      else if (isPunct(t, ')')) {
        if (depth === 0) break;
        depth -= 1;
      } else if (depth === 0 && (t.kind === 'word' || t.kind === 'identifier')) {
        // Only the first word of each item is a column name ("a ASC", "b(10)").
        const prev = toks[i - 1];
        if (isPunct(prev, '(') || isPunct(prev, ',')) names.push(unquote(t.text));
      }
    }
    return { names, next: i + 1 };
  }

  private references(toks: Tok[], k: number, columns: string[]): ForeignKeyModel {
    // toks[k] is REFERENCES
    const sub = new DdlSubParser(toks, k + 1);
    const parts = sub.name();
    const { names, next } = this.columnList(toks, sub.index);
    let onDelete: string | null = null;
    for (let i = next; i < toks.length; i += 1) {
      if (upper(toks[i]) === 'ON' && upper(toks[i + 1]) === 'DELETE') {
        const a = upper(toks[i + 2]);
        onDelete =
          a === 'SET' || a === 'NO'
            ? `${a.toLowerCase()} ${upper(toks[i + 3]).toLowerCase()}`
            : a.toLowerCase();
      }
    }
    return {
      columns,
      refTable: parts.at(-1) ?? '',
      refSchema: parts.length > 1 ? (parts.at(-2) ?? null) : null,
      refColumns: names,
      onDelete,
    };
  }

  private constraint(toks: Tok[], table: TableModel) {
    const head = upper(toks[0]);
    let k = 1;
    if (head === 'PRIMARY' || head === 'FOREIGN') k = 2; // KEY
    while (k < toks.length && !isPunct(toks[k], '(')) k += 1; // CLUSTERED, index names…
    const { names, next } = this.columnList(toks, k);
    if (head === 'PRIMARY') {
      for (const n of names) if (!table.primaryKey.includes(n)) table.primaryKey.push(n);
    } else if (head === 'FOREIGN') {
      const r = toks.findIndex((t, i) => i >= next - 1 && upper(t) === 'REFERENCES');
      if (r >= 0) table.foreignKeys.push(this.references(toks, r, names));
    } else if (head === 'UNIQUE' && names.length === 1) {
      const c = table.columns.find((x) => x.name === names[0]);
      if (c) c.unique = true;
    }
  }

  private column(toks: Tok[], table: TableModel) {
    const first = toks[0];
    if (!first || (first.kind !== 'word' && first.kind !== 'identifier'))
      this.fail('Expected a column name', first);
    const col: ColumnModel = {
      name: unquote(first.text),
      type: '',
      length: null,
      scale: null,
      nullable: true,
      primaryKey: false,
      identity: false,
      unique: false,
      defaultValue: null,
    };
    let i = 1;
    const typeWords: string[] = [];
    while (
      i < toks.length &&
      toks[i]?.kind === 'word' &&
      (typeWords.length === 0 || TYPE_WORDS.has(upper(toks[i])))
    ) {
      if (typeWords.length > 0 && COLUMN_STOP.has(upper(toks[i]))) break;
      if (typeWords.length === 0 && COLUMN_STOP.has(upper(toks[i]))) break;
      typeWords.push(upper(toks[i]));
      i += 1;
      if (isPunct(toks[i], '(')) {
        const args: string[] = [];
        let depth = 0;
        for (i += 1; i < toks.length; i += 1) {
          const t = toks[i];
          if (!t) break;
          if (isPunct(t, '(')) depth += 1;
          else if (isPunct(t, ')')) {
            if (depth === 0) break;
            depth -= 1;
          } else if (!isPunct(t, ',') && depth === 0) args.push(t.text);
        }
        i += 1;
        const [len, scale] = args;
        col.length = len !== undefined && /^\d+$/.test(len) ? Number(len) : null;
        col.scale = scale !== undefined && /^\d+$/.test(scale) ? Number(scale) : null;
      }
    }
    col.type =
      typeWords.filter((w) => !['UNSIGNED', 'SIGNED', 'ZEROFILL'].includes(w)).join(' ') ||
      (toks[1]?.kind === 'identifier' ? unquote(toks[1].text).toUpperCase() : 'TEXT');
    if (typeWords.length === 0 && toks[1]?.kind === 'identifier') i = 2;
    if (/^(BIG|SMALL)?SERIAL\d?$/.test(col.type)) col.identity = true;
    for (; i < toks.length; i += 1) {
      const w = upper(toks[i]);
      if (w === 'NOT' && upper(toks[i + 1]) === 'NULL') {
        col.nullable = false;
        i += 1;
      } else if (w === 'NULL') col.nullable = true;
      else if (w === 'PRIMARY') {
        col.primaryKey = true;
        col.nullable = false;
        if (!table.primaryKey.includes(col.name)) table.primaryKey.push(col.name);
      } else if (w === 'UNIQUE') col.unique = true;
      else if (w === 'IDENTITY' || w === 'AUTO_INCREMENT' || w === 'AUTOINCREMENT')
        col.identity = true;
      else if (w === 'GENERATED' && toks.slice(i, i + 5).some((t) => upper(t) === 'IDENTITY'))
        col.identity = true;
      else if (w === 'REFERENCES') {
        table.foreignKeys.push(this.references(toks, i, [col.name]));
        break;
      } else if (w === 'DEFAULT') {
        const start = toks[i + 1];
        let end = i + 1;
        let depth = 0;
        for (; end < toks.length; end += 1) {
          const t = toks[end];
          if (isPunct(t, '(')) depth += 1;
          else if (isPunct(t, ')')) depth -= 1;
          else if (depth === 0 && end > i + 1 && COLUMN_STOP.has(upper(t)) && upper(t) !== 'NULL')
            break;
        }
        const last = toks[end - 1];
        if (start && last)
          col.defaultValue = this.sql
            .slice(start.start, last.start + last.text.length)
            .replace(/^\((.*)\)$/s, '$1');
        i = end - 1;
      } else if (isPunct(toks[i], '(')) {
        // CHECK (…) and similar: skip the group.
        let depth = 0;
        for (; i < toks.length; i += 1) {
          if (isPunct(toks[i], '(')) depth += 1;
          else if (isPunct(toks[i], ')')) {
            depth -= 1;
            if (depth === 0) break;
          }
        }
      }
    }
    table.columns.push(col);
  }
}

/** Reads a qualified name from a token list (used for REFERENCES). */
class DdlSubParser {
  index: number;
  private readonly toks: Tok[];
  constructor(toks: Tok[], index: number) {
    this.toks = toks;
    this.index = index;
  }
  name(): string[] {
    const parts: string[] = [];
    while (this.index < this.toks.length) {
      const t = this.toks[this.index];
      if (!t) break;
      if (t.kind === 'identifier') parts.push(unquote(t.text));
      else if (t.kind === 'word' && !COLUMN_STOP.has(t.text.toUpperCase()))
        parts.push(...t.text.split('.').filter(Boolean));
      else break;
      this.index += 1;
      const next = this.toks[this.index];
      if (
        !(next?.kind === 'word' && next.text.startsWith('.')) &&
        !(t.kind === 'word' && t.text.endsWith('.'))
      )
        break;
    }
    return parts;
  }
}

/** Extracts every CREATE TABLE of a script (other statements are ignored). */
export function parseTables(sql: string, dialect: SqlDialect): TableModel[] {
  if (!sql.trim()) throw new ValidationError('Paste one or more CREATE TABLE statements.');
  const tables = new DdlParser(sql, dialect).tables();
  if (tables.length === 0) throw new ValidationError('No CREATE TABLE statement found.');
  return tables;
}
