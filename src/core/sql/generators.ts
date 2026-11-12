import { ValidationError } from '../errors/AppError';
import { csvToJson } from '../json/csv';
import { isJsonObject } from '../json/objects';
import { parseJsonOrThrow } from '../json/parse';
import { qualifiedName, quoteIdentifier, type SqlDialect } from './dialects';
import { sqlBooleanLiteral, sqlLiteral, sqlStringLiteral } from './literals';
import type { ColumnModel, ForeignKeyModel, TableModel } from './schema';

/** SELECT / INSERT / UPDATE / DELETE generators for a table described by CREATE TABLE. */

export type ValueMode = 'parameters' | 'literals';
export const OPERATORS = [
  '=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'LIKE',
  'IN',
  'BETWEEN',
  'IS NULL',
  'IS NOT NULL',
] as const;
export type Operator = (typeof OPERATORS)[number];

export interface Condition {
  column: string;
  operator: Operator;
  /** Literal mode: the value ("a, b" for IN, "1, 10" for BETWEEN). Ignored for IS (NOT) NULL. */
  value: string;
}

export interface GeneratedSql {
  sql: string;
  parameters: { name: string; column: string }[];
  notes: string[];
}

interface Common {
  table: TableModel;
  dialect: SqlDialect;
  valueMode: ValueMode;
  quoteAll: boolean;
}

/** Placeholders per dialect: @name (SQL Server), $1 (PostgreSQL), ? (MySQL), :name (SQLite). */
class Params {
  readonly list: { name: string; column: string }[] = [];
  private readonly used = new Set<string>();
  private readonly dialect: SqlDialect;
  constructor(dialect: SqlDialect) {
    this.dialect = dialect;
  }
  next(column: string, suffix = ''): string {
    const base = (column + suffix).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'p';
    let name = base;
    for (let n = 2; this.used.has(name.toLowerCase()); n += 1) name = `${base}_${String(n)}`;
    this.used.add(name.toLowerCase());
    this.list.push({ name, column });
    switch (this.dialect) {
      case 'mssql':
        return `@${name}`;
      case 'postgresql':
        return `$${String(this.list.length)}`;
      case 'mysql':
        return '?';
      case 'sqlite':
        return `:${name}`;
    }
  }
}

const NUMERIC = /INT|SERIAL|DECIMAL|NUMERIC|MONEY|FLOAT|REAL|DOUBLE|DEC$/i;
const BOOLEAN = /^(BIT|BOOL|BOOLEAN)$/i;

/** Literal for text typed by the user, interpreted by the column's type. */
export function literalFor(
  raw: string,
  column: ColumnModel | undefined,
  dialect: SqlDialect,
): string {
  const v = raw.trim();
  if (/^null$/i.test(v)) return 'NULL';
  if (column && NUMERIC.test(column.type) && /^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(v)) return v;
  if (column && BOOLEAN.test(column.type) && /^(true|false|1|0)$/i.test(v))
    return sqlBooleanLiteral(/^(true|1)$/i.test(v), dialect);
  return sqlStringLiteral(raw, dialect);
}

function aliasFor(name: string, taken: Set<string>): string {
  const words = name.split(/[_\s.-]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
  const base = (words.map((w) => w[0] ?? '').join('') || 't').toLowerCase();
  let alias = base;
  for (let n = 2; taken.has(alias); n += 1) alias = `${base}${String(n)}`;
  taken.add(alias);
  return alias;
}

function conditionSql(c: Condition, ref: string, o: Common, params: Params): string {
  const col = o.table.columns.find((x) => x.name === c.column);
  if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') return `${ref} ${c.operator}`;
  const lit = (v: string) => literalFor(v, col, o.dialect);
  if (c.operator === 'IN') {
    if (o.valueMode === 'parameters') return `${ref} IN (${params.next(c.column, '_list')})`;
    const values = c.value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0)
      throw new ValidationError(`Give at least one value for ${c.column} IN (…).`);
    return `${ref} IN (${values.map(lit).join(', ')})`;
  }
  if (c.operator === 'BETWEEN') {
    if (o.valueMode === 'parameters')
      return `${ref} BETWEEN ${params.next(c.column, '_from')} AND ${params.next(c.column, '_to')}`;
    const [from = '', to = ''] = c.value.split(',').map((v) => v.trim());
    return `${ref} BETWEEN ${lit(from)} AND ${lit(to)}`;
  }
  return `${ref} ${c.operator} ${o.valueMode === 'parameters' ? params.next(c.column) : lit(c.value)}`;
}

function whereSql(
  conditions: readonly Condition[],
  join: 'AND' | 'OR',
  ref: (c: string) => string,
  o: Common,
  params: Params,
) {
  const parts = conditions
    .filter((c) => c.column)
    .map((c) => conditionSql(c, ref(c.column), o, params));
  return parts.length ? `WHERE ${parts.join(`\n  ${join} `)}` : '';
}

const q = (name: string, o: Common) => quoteIdentifier(name, o.dialect, o.quoteAll);
const tableRef = (o: Common) => qualifiedName(o.table.name, o.table.schema, o.dialect, o.quoteAll);

export interface SelectSpec extends Common {
  /** Empty = every column of the table. */
  columns: string[];
  distinct: boolean;
  count: boolean;
  where: Condition[];
  whereJoin: 'AND' | 'OR';
  orderBy: { column: string; direction: 'ASC' | 'DESC' }[];
  limit: number | null;
  offset: number | null;
  joins: { foreignKey: ForeignKeyModel; type: 'INNER' | 'LEFT'; table?: TableModel }[];
}

export function generateSelect(s: SelectSpec): GeneratedSql {
  const params = new Params(s.dialect);
  const notes: string[] = [];
  const aliases = new Set<string>();
  const joined = s.joins.length > 0;
  const main = joined ? aliasFor(s.table.name, aliases) : '';
  const col = (name: string, alias = main) => (alias ? `${alias}.${q(name, s)}` : q(name, s));
  const columns = (s.columns.length ? s.columns : s.table.columns.map((c) => c.name)).map((c) =>
    col(c),
  );
  const joinLines: string[] = [];
  for (const j of s.joins) {
    const alias = aliasFor(j.foreignKey.refTable, aliases);
    const on = j.foreignKey.columns
      .map((c, i) => `${alias}.${q(j.foreignKey.refColumns[i] ?? 'id', s)} = ${col(c)}`)
      .join(' AND ');
    joinLines.push(
      `${j.type} JOIN ${qualifiedName(j.foreignKey.refTable, j.foreignKey.refSchema, s.dialect, s.quoteAll)} ${alias} ON ${on}`,
    );
    if (j.table)
      columns.push(
        ...j.table.columns
          .filter((c) => !j.foreignKey.refColumns.includes(c.name))
          .map((c) => `${alias}.${q(c.name, s)}`),
      );
  }
  if (s.columns.length === 0 && s.table.columns.length === 0) columns.push('*');
  const useTop = s.dialect === 'mssql' && s.limit !== null && !s.offset;
  const head = `SELECT ${s.distinct ? 'DISTINCT ' : ''}${useTop ? `TOP (${String(s.limit)}) ` : ''}`;
  const lines = [
    s.count ? `${head}COUNT(*) AS ${q('total', s)}` : `${head}\n  ${columns.join(',\n  ')}`,
    `FROM ${tableRef(s)}${main ? ` ${main}` : ''}`,
    ...joinLines,
  ];
  const where = whereSql(s.where, s.whereJoin, (c) => col(c), s, params);
  if (where) lines.push(where);
  const order = s.orderBy.filter((o) => o.column).map((o) => `${col(o.column)} ${o.direction}`);
  if (!s.count && order.length) lines.push(`ORDER BY ${order.join(', ')}`);
  if (!s.count && (s.limit !== null || s.offset)) {
    if (s.dialect === 'mssql') {
      if (!useTop) {
        if (!order.length) lines.push('ORDER BY (SELECT NULL)');
        lines.push(
          `OFFSET ${String(s.offset ?? 0)} ROWS${s.limit !== null ? ` FETCH NEXT ${String(s.limit)} ROWS ONLY` : ''}`,
        );
      }
    } else {
      if (s.limit !== null) lines.push(`LIMIT ${String(s.limit)}`);
      else if (s.offset && s.dialect !== 'postgresql')
        lines.push(s.dialect === 'mysql' ? 'LIMIT 18446744073709551615' : 'LIMIT -1');
      if (s.offset) lines.push(`OFFSET ${String(s.offset)}`);
    }
    if (!order.length) notes.push('Paging without ORDER BY returns rows in no particular order.');
  }
  return { sql: `${lines.join('\n')};\n`, parameters: params.list, notes };
}

export interface InsertSpec extends Common {
  /** Columns to insert; empty = every column (identity columns skipped when skipIdentity). */
  columns: string[];
  skipIdentity: boolean;
  /** JSON or CSV rows; null = one statement with placeholders/sample values. */
  data: { format: 'json' | 'csv'; text: string } | null;
  rowsPerStatement: number;
  onConflict: 'none' | 'ignore' | 'update';
}

export const MAX_INSERT_ROWS = 50_000;

export function parseRows(data: {
  format: 'json' | 'csv';
  text: string;
}): Record<string, unknown>[] {
  if (data.format === 'csv') return csvToJson(data.text).value.filter(isJsonObject);
  const value = parseJsonOrThrow(data.text, 'JSON');
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.every(isJsonObject))
    throw new ValidationError('The JSON must be an object or an array of objects.');
  return rows;
}

export function generateInsert(s: InsertSpec): GeneratedSql {
  const params = new Params(s.dialect);
  const notes: string[] = [];
  const rows = s.data ? parseRows(s.data) : null;
  if (rows && rows.length > MAX_INSERT_ROWS)
    throw new ValidationError(
      `At most ${MAX_INSERT_ROWS.toLocaleString('en-US')} rows can be converted at once.`,
    );
  const known = s.table.columns.filter((c) => !(s.skipIdentity && c.identity));
  let columns = s.columns.length ? s.columns : known.map((c) => c.name);
  if (rows && s.table.columns.length === 0)
    columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  if (columns.length === 0) throw new ValidationError('Choose at least one column.');
  if (rows) {
    const missing = columns.filter(
      (c) => !rows.some((r) => Object.prototype.hasOwnProperty.call(r, c)),
    );
    if (missing.length) notes.push(`No data for ${missing.join(', ')}: inserted as NULL.`);
    const extra = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter(
      (k) => !columns.includes(k),
    );
    if (extra.length)
      notes.push(
        `Ignored fields not in the table: ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? '…' : ''}.`,
      );
  }
  const head = `INSERT ${s.onConflict === 'ignore' && s.dialect === 'mysql' ? 'IGNORE ' : ''}INTO ${tableRef(s)} (${columns.map((c) => q(c, s)).join(', ')})`;
  const pk = s.table.primaryKey.length ? s.table.primaryKey : [];
  const tail = (() => {
    if (s.onConflict === 'none') return '';
    if (s.dialect === 'mssql') {
      notes.push('SQL Server has no ON CONFLICT; use MERGE for upserts. Plain INSERT generated.');
      return '';
    }
    if (s.onConflict === 'ignore')
      return s.dialect === 'mysql'
        ? ''
        : `\nON CONFLICT${pk.length ? ` (${pk.map((c) => q(c, s)).join(', ')})` : ''} DO NOTHING`;
    const updatable = columns.filter((c) => !pk.includes(c));
    if (s.dialect === 'mysql')
      return `\nON DUPLICATE KEY UPDATE ${updatable.map((c) => `${q(c, s)} = VALUES(${q(c, s)})`).join(', ')}`;
    if (!pk.length)
      throw new ValidationError(
        'An upsert needs a primary key (add PRIMARY KEY to the CREATE TABLE).',
      );
    return `\nON CONFLICT (${pk.map((c) => q(c, s)).join(', ')}) DO UPDATE SET ${updatable.map((c) => `${q(c, s)} = EXCLUDED.${q(c, s)}`).join(', ')}`;
  })();
  if (!rows) {
    const values = columns.map((c) =>
      s.valueMode === 'parameters'
        ? params.next(c)
        : sampleValue(
            s.table.columns.find((x) => x.name === c),
            s.dialect,
          ),
    );
    return {
      sql: `${head}\nVALUES (${values.join(', ')})${tail};\n`,
      parameters: params.list,
      notes,
    };
  }
  if (rows.length === 0) throw new ValidationError('The data has no rows.');
  const size = Math.max(1, Math.min(s.dialect === 'mssql' ? 1000 : 10_000, s.rowsPerStatement));
  const statements: string[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const tuples = rows
      .slice(i, i + size)
      .map((r) => `  (${columns.map((c) => sqlLiteral(r[c], s.dialect)).join(', ')})`);
    statements.push(`${head}\nVALUES\n${tuples.join(',\n')}${tail};`);
  }
  if (s.dialect === 'mssql' && s.rowsPerStatement > 1000)
    notes.push('SQL Server allows at most 1,000 rows per VALUES list.');
  return { sql: `${statements.join('\n\n')}\n`, parameters: [], notes };
}

function sampleValue(c: ColumnModel | undefined, dialect: SqlDialect): string {
  if (!c) return 'NULL';
  if (c.defaultValue !== null) return 'DEFAULT';
  if (NUMERIC.test(c.type)) return '0';
  if (BOOLEAN.test(c.type)) return sqlBooleanLiteral(false, dialect);
  if (/DATE|TIME/i.test(c.type))
    return sqlStringLiteral(
      c.type.toUpperCase() === 'DATE' ? '2024-01-31' : '2024-01-31T12:00:00',
      dialect,
    );
  if (/UUID|UNIQUEIDENTIFIER/i.test(c.type))
    return sqlStringLiteral('00000000-0000-0000-0000-000000000000', dialect);
  return sqlStringLiteral(c.nullable ? '' : c.name, dialect);
}

export interface UpdateSpec extends Common {
  set: { column: string; value: string }[];
  where: Condition[];
  whereJoin: 'AND' | 'OR';
  /** Without this, an UPDATE without WHERE is refused. */
  allowAllRows: boolean;
}

function requireWhere(where: string, allow: boolean, verb: string) {
  if (!where && !allow)
    throw new ValidationError(
      `Add a WHERE condition, or confirm that the ${verb} may change every row.`,
    );
}

/** Conditions on the primary key, as a sensible default WHERE. */
export function primaryKeyConditions(table: TableModel): Condition[] {
  return table.primaryKey.map((column) => ({ column, operator: '=', value: '' }));
}

export function generateUpdate(s: UpdateSpec): GeneratedSql {
  const params = new Params(s.dialect);
  const set = s.set.filter((x) => x.column);
  if (set.length === 0) throw new ValidationError('Choose at least one column to update.');
  const assignments = set.map(
    (x) =>
      `${q(x.column, s)} = ${
        s.valueMode === 'parameters'
          ? params.next(x.column)
          : literalFor(
              x.value,
              s.table.columns.find((c) => c.name === x.column),
              s.dialect,
            )
      }`,
  );
  const where = whereSql(s.where, s.whereJoin, (c) => q(c, s), s, params);
  requireWhere(where, s.allowAllRows, 'UPDATE');
  const sql = [`UPDATE ${tableRef(s)}`, `SET ${assignments.join(',\n    ')}`, where]
    .filter(Boolean)
    .join('\n');
  return {
    sql: `${sql};\n`,
    parameters: params.list,
    notes: where ? [] : ['This UPDATE changes every row.'],
  };
}

export interface DeleteSpec extends Common {
  where: Condition[];
  whereJoin: 'AND' | 'OR';
  allowAllRows: boolean;
  /** Emit a SELECT COUNT(*) with the same WHERE first. */
  previewCount: boolean;
  /** Wrap in a transaction that you commit or roll back by hand. */
  transaction: boolean;
  /** Soft delete: UPDATE this column to the current time instead of deleting. */
  softDeleteColumn: string | null;
}

const NOW: Record<SqlDialect, string> = {
  mssql: 'SYSUTCDATETIME()',
  postgresql: 'now()',
  mysql: 'CURRENT_TIMESTAMP',
  sqlite: 'CURRENT_TIMESTAMP',
};
const BEGIN: Record<SqlDialect, string> = {
  mssql: 'BEGIN TRANSACTION;',
  postgresql: 'BEGIN;',
  mysql: 'START TRANSACTION;',
  sqlite: 'BEGIN TRANSACTION;',
};

export function generateDelete(s: DeleteSpec): GeneratedSql {
  const params = new Params(s.dialect);
  const where = whereSql(s.where, s.whereJoin, (c) => q(c, s), s, params);
  requireWhere(where, s.allowAllRows, 'DELETE');
  const parts: string[] = [];
  if (s.transaction) parts.push(BEGIN[s.dialect], '');
  if (s.previewCount) {
    // The preview uses its own copy of the parameters (same names).
    const preview = new Params(s.dialect);
    const pw = whereSql(s.where, s.whereJoin, (c) => q(c, s), s, preview);
    parts.push(
      '-- Rows that will be deleted:',
      `SELECT COUNT(*) AS ${q('affected', s)}\nFROM ${tableRef(s)}${pw ? `\n${pw}` : ''};`,
      '',
    );
  }
  if (s.softDeleteColumn)
    parts.push(
      `UPDATE ${tableRef(s)}\nSET ${q(s.softDeleteColumn, s)} = ${NOW[s.dialect]}${where ? `\n${where}` : ''};`,
    );
  else parts.push(`DELETE FROM ${tableRef(s)}${where ? `\n${where}` : ''};`);
  if (s.transaction)
    parts.push(
      '',
      '-- Check the result, then run one of:',
      s.dialect === 'mssql' ? '-- COMMIT TRANSACTION;' : '-- COMMIT;',
      s.dialect === 'mssql' ? '-- ROLLBACK TRANSACTION;' : '-- ROLLBACK;',
    );
  const notes = where ? [] : ['This DELETE removes every row.'];
  return { sql: `${parts.join('\n')}\n`, parameters: params.list, notes };
}
