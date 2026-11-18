import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { ParseError, ValidationError } from '../errors/AppError';
import { safeJsonParse } from '../security/safeJsonParse';
import { qualifiedName, quoteIdentifier, type SqlDialect } from './dialects';
import type { TableModel } from './schema';

/** Schema Designer model: portable column types, generated as DDL for each dialect. */

export const PORTABLE_TYPES = [
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'DECIMAL',
  'FLOAT',
  'BOOLEAN',
  'VARCHAR',
  'CHAR',
  'TEXT',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'TIMESTAMPTZ',
  'UUID',
  'JSON',
  'BINARY',
] as const;
export type PortableType = (typeof PORTABLE_TYPES)[number];
export const ON_DELETE = ['NO ACTION', 'CASCADE', 'SET NULL', 'RESTRICT'] as const;

const columnSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(128),
  type: z.enum(PORTABLE_TYPES),
  length: z.number().int().min(1).max(1_000_000).nullable(),
  scale: z.number().int().min(0).max(38).nullable(),
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  identity: z.boolean(),
  unique: z.boolean(),
  defaultValue: z.string().max(500),
});
const tableSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(128),
  columns: z.array(columnSchema).max(500),
});
const relationSchema = z.object({
  id: z.string().min(1).max(64),
  fromTable: z.string(),
  fromColumn: z.string(),
  toTable: z.string(),
  toColumn: z.string(),
  onDelete: z.enum(ON_DELETE),
});
export const designSchema = z.object({
  version: z.literal(1),
  tables: z.array(tableSchema).max(500),
  relations: z.array(relationSchema).max(2000),
});

export type DesignColumn = z.infer<typeof columnSchema>;
export type DesignTable = z.infer<typeof tableSchema>;
export type DesignRelation = z.infer<typeof relationSchema>;
export type SchemaDesign = z.infer<typeof designSchema>;

export const newId = (): string => uuid();

export function emptyDesign(): SchemaDesign {
  return { version: 1, tables: [], relations: [] };
}

export function newColumn(patch: Partial<DesignColumn> = {}): DesignColumn {
  return {
    id: newId(),
    name: '',
    type: 'VARCHAR',
    length: 255,
    scale: null,
    nullable: true,
    primaryKey: false,
    identity: false,
    unique: false,
    defaultValue: '',
    ...patch,
  };
}

export function newTable(name: string): DesignTable {
  return {
    id: newId(),
    name,
    columns: [
      newColumn({
        name: 'id',
        type: 'INTEGER',
        length: null,
        nullable: false,
        primaryKey: true,
        identity: true,
      }),
    ],
  };
}

/** Maps a parsed SQL type to the nearest portable type. */
export function portableType(
  type: string,
  length: number | null,
): { type: PortableType; length: number | null } {
  const t = type.toUpperCase();
  if (/^(BIGSERIAL|SERIAL8|BIGINT|INT8)$/.test(t)) return { type: 'BIGINT', length: null };
  if (/^(SMALLINT|TINYINT|INT2|SMALLSERIAL)$/.test(t))
    return { type: t === 'TINYINT' && length === 1 ? 'BOOLEAN' : 'SMALLINT', length: null };
  if (/INT|SERIAL/.test(t)) return { type: 'INTEGER', length: null };
  if (/^(DECIMAL|NUMERIC|DEC|MONEY|SMALLMONEY)$/.test(t))
    return { type: 'DECIMAL', length: length ?? 18 };
  if (/FLOAT|REAL|DOUBLE/.test(t)) return { type: 'FLOAT', length: null };
  if (/^(BIT|BOOL|BOOLEAN)$/.test(t)) return { type: 'BOOLEAN', length: null };
  if (/^N?CHAR(ACTER)?$/.test(t)) return { type: 'CHAR', length: length ?? 1 };
  if (/CHAR|VARYING/.test(t))
    return length ? { type: 'VARCHAR', length } : { type: 'TEXT', length: null };
  if (/TEXT|CLOB|XML|CITEXT/.test(t)) return { type: 'TEXT', length: null };
  if (t === 'DATE') return { type: 'DATE', length: null };
  if (/^TIME( WITH(OUT)? TIME ZONE)?$/.test(t)) return { type: 'TIME', length: null };
  if (/TIMESTAMPTZ|WITH TIME ZONE|DATETIMEOFFSET/.test(t))
    return { type: 'TIMESTAMPTZ', length: null };
  if (/DATETIME|TIMESTAMP/.test(t)) return { type: 'TIMESTAMP', length: null };
  if (/UUID|UNIQUEIDENTIFIER/.test(t)) return { type: 'UUID', length: null };
  if (/JSON/.test(t)) return { type: 'JSON', length: null };
  if (/BINARY|BLOB|BYTEA|IMAGE/.test(t)) return { type: 'BINARY', length: null };
  return { type: 'TEXT', length: null };
}

/** Builds a design from parsed CREATE TABLE statements (foreign keys become relations). */
export function designFromTables(tables: readonly TableModel[]): SchemaDesign {
  const design = emptyDesign();
  for (const t of tables) {
    design.tables.push({
      id: newId(),
      name: t.name,
      columns: t.columns.map((c) => {
        const p = portableType(c.type, c.length);
        return newColumn({
          name: c.name,
          type: p.type,
          length: p.length,
          scale: p.type === 'DECIMAL' ? (c.scale ?? 2) : null,
          nullable: c.nullable,
          primaryKey: c.primaryKey,
          identity: c.identity,
          unique: c.unique,
          defaultValue: c.defaultValue ?? '',
        });
      }),
    });
  }
  const findTable = (name: string) =>
    design.tables.find((x) => x.name.toLowerCase() === name.toLowerCase());
  tables.forEach((t, i) => {
    const from = design.tables[i];
    if (!from) return;
    for (const fk of t.foreignKeys) {
      const to = findTable(fk.refTable);
      fk.columns.forEach((col, k) => {
        const fromCol = from.columns.find((c) => c.name === col);
        const refName = fk.refColumns[k] ?? to?.columns.find((c) => c.primaryKey)?.name;
        const toCol = to?.columns.find((c) => c.name === refName);
        if (!to || !fromCol || !toCol) return;
        const action = (fk.onDelete ?? '').toUpperCase();
        design.relations.push({
          id: newId(),
          fromTable: from.id,
          fromColumn: fromCol.id,
          toTable: to.id,
          toColumn: toCol.id,
          onDelete: ON_DELETE.find((a) => a === action) ?? 'NO ACTION',
        });
      });
    }
  });
  return design;
}

export interface DesignIssue {
  severity: 'error' | 'warning';
  message: string;
  tableId?: string;
}

const NAME = /^[\p{L}_][\p{L}\p{N}_ $-]*$/u;

export function validateDesign(d: SchemaDesign): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const names = new Map<string, number>();
  for (const t of d.tables)
    names.set(t.name.toLowerCase(), (names.get(t.name.toLowerCase()) ?? 0) + 1);
  for (const t of d.tables) {
    const label = t.name || '(unnamed table)';
    if (!t.name.trim())
      issues.push({ severity: 'error', message: 'A table has no name.', tableId: t.id });
    else if (!NAME.test(t.name))
      issues.push({
        severity: 'warning',
        message: `Table "${label}" has unusual characters; it will be quoted.`,
        tableId: t.id,
      });
    if ((names.get(t.name.toLowerCase()) ?? 0) > 1)
      issues.push({
        severity: 'error',
        message: `There are several tables named "${label}".`,
        tableId: t.id,
      });
    if (t.columns.length === 0)
      issues.push({
        severity: 'error',
        message: `Table "${label}" has no columns.`,
        tableId: t.id,
      });
    const cols = new Map<string, number>();
    for (const c of t.columns)
      cols.set(c.name.toLowerCase(), (cols.get(c.name.toLowerCase()) ?? 0) + 1);
    for (const c of t.columns) {
      if (!c.name.trim())
        issues.push({
          severity: 'error',
          message: `A column of "${label}" has no name.`,
          tableId: t.id,
        });
      else if ((cols.get(c.name.toLowerCase()) ?? 0) > 1)
        issues.push({
          severity: 'error',
          message: `"${label}" has several columns named "${c.name}".`,
          tableId: t.id,
        });
      if (c.identity && !['INTEGER', 'BIGINT', 'SMALLINT'].includes(c.type))
        issues.push({
          severity: 'error',
          message: `"${label}.${c.name}" is auto-increment but not an integer.`,
          tableId: t.id,
        });
    }
    if (t.columns.length > 0 && !t.columns.some((c) => c.primaryKey))
      issues.push({
        severity: 'warning',
        message: `Table "${label}" has no primary key.`,
        tableId: t.id,
      });
  }
  for (const r of d.relations) {
    const from = d.tables.find((t) => t.id === r.fromTable);
    const to = d.tables.find((t) => t.id === r.toTable);
    const fc = from?.columns.find((c) => c.id === r.fromColumn);
    const tc = to?.columns.find((c) => c.id === r.toColumn);
    if (!from || !to || !fc || !tc) {
      issues.push({
        severity: 'error',
        message: 'A relationship points to a table or column that no longer exists.',
        ...(from ? { tableId: from.id } : {}),
      });
      continue;
    }
    if (!tc.primaryKey && !tc.unique)
      issues.push({
        severity: 'warning',
        message: `${from.name}.${fc.name} references ${to.name}.${tc.name}, which is neither a primary key nor unique.`,
        tableId: from.id,
      });
    if (r.onDelete === 'SET NULL' && !fc.nullable)
      issues.push({
        severity: 'error',
        message: `${from.name}.${fc.name} is NOT NULL, so ON DELETE SET NULL cannot work.`,
        tableId: from.id,
      });
  }
  return issues;
}

function typeSql(c: DesignColumn, dialect: SqlDialect): string {
  const len = c.length;
  const dec = `(${String(c.length ?? 18)}, ${String(c.scale ?? 2)})`;
  const map: Record<PortableType, Record<SqlDialect, string>> = {
    INTEGER: { mssql: 'INT', postgresql: 'INTEGER', mysql: 'INT', sqlite: 'INTEGER' },
    BIGINT: { mssql: 'BIGINT', postgresql: 'BIGINT', mysql: 'BIGINT', sqlite: 'INTEGER' },
    SMALLINT: { mssql: 'SMALLINT', postgresql: 'SMALLINT', mysql: 'SMALLINT', sqlite: 'INTEGER' },
    DECIMAL: {
      mssql: `DECIMAL${dec}`,
      postgresql: `NUMERIC${dec}`,
      mysql: `DECIMAL${dec}`,
      sqlite: 'NUMERIC',
    },
    FLOAT: { mssql: 'FLOAT', postgresql: 'DOUBLE PRECISION', mysql: 'DOUBLE', sqlite: 'REAL' },
    BOOLEAN: { mssql: 'BIT', postgresql: 'BOOLEAN', mysql: 'BOOLEAN', sqlite: 'INTEGER' },
    VARCHAR: {
      mssql: `NVARCHAR(${len ? String(len) : 'MAX'})`,
      postgresql: len ? `VARCHAR(${String(len)})` : 'VARCHAR',
      mysql: `VARCHAR(${String(len ?? 255)})`,
      sqlite: 'TEXT',
    },
    CHAR: {
      mssql: `NCHAR(${String(len ?? 1)})`,
      postgresql: `CHAR(${String(len ?? 1)})`,
      mysql: `CHAR(${String(len ?? 1)})`,
      sqlite: 'TEXT',
    },
    TEXT: { mssql: 'NVARCHAR(MAX)', postgresql: 'TEXT', mysql: 'TEXT', sqlite: 'TEXT' },
    DATE: { mssql: 'DATE', postgresql: 'DATE', mysql: 'DATE', sqlite: 'TEXT' },
    TIME: { mssql: 'TIME', postgresql: 'TIME', mysql: 'TIME', sqlite: 'TEXT' },
    TIMESTAMP: { mssql: 'DATETIME2', postgresql: 'TIMESTAMP', mysql: 'DATETIME', sqlite: 'TEXT' },
    TIMESTAMPTZ: {
      mssql: 'DATETIMEOFFSET',
      postgresql: 'TIMESTAMPTZ',
      mysql: 'TIMESTAMP',
      sqlite: 'TEXT',
    },
    UUID: { mssql: 'UNIQUEIDENTIFIER', postgresql: 'UUID', mysql: 'CHAR(36)', sqlite: 'TEXT' },
    JSON: { mssql: 'NVARCHAR(MAX)', postgresql: 'JSONB', mysql: 'JSON', sqlite: 'TEXT' },
    BINARY: { mssql: 'VARBINARY(MAX)', postgresql: 'BYTEA', mysql: 'BLOB', sqlite: 'BLOB' },
  };
  return map[c.type][dialect];
}

export interface DdlOptions {
  dropExisting: boolean;
  quoteAll: boolean;
}

const constraintName = (s: string) => s.replace(/[^\p{L}\p{N}_]+/gu, '_').slice(0, 60);

/** Tables in creation order (referenced tables first); returns the edges left in cycles. */
function creationOrder(d: SchemaDesign): { order: DesignTable[]; deferred: Set<string> } {
  const deps = new Map(
    d.tables.map((t) => [
      t.id,
      new Set(
        d.relations.filter((r) => r.fromTable === t.id && r.toTable !== t.id).map((r) => r.toTable),
      ),
    ]),
  );
  const order: DesignTable[] = [];
  const placed = new Set<string>();
  const deferred = new Set<string>();
  let remaining = [...d.tables];
  while (remaining.length) {
    const ready = remaining.filter((t) => [...(deps.get(t.id) ?? [])].every((x) => placed.has(x)));
    const next = ready.length ? ready : remaining.slice(0, 1);
    if (!ready.length) {
      // Cycle: create this table first; its references to unplaced tables are added afterwards.
      for (const r of d.relations)
        if (r.fromTable === next[0]?.id && !placed.has(r.toTable) && r.toTable !== r.fromTable)
          deferred.add(r.id);
    }
    for (const t of next) {
      order.push(t);
      placed.add(t.id);
    }
    remaining = remaining.filter((t) => !placed.has(t.id));
  }
  return { order, deferred };
}

/** CREATE TABLE script for a dialect; refuses designs with errors. */
export function generateDdl(
  d: SchemaDesign,
  dialect: SqlDialect,
  options: Partial<DdlOptions> = {},
): { sql: string; notes: string[] } {
  const errors = validateDesign(d).filter((i) => i.severity === 'error');
  if (errors.length) throw new ValidationError(errors[0]?.message ?? 'The design has errors.');
  if (d.tables.length === 0) throw new ValidationError('Add a table to generate DDL.');
  const q = (n: string) => quoteIdentifier(n, dialect, options.quoteAll ?? false);
  const notes: string[] = [];
  const { order, deferred } = creationOrder(d);
  const byId = new Map(d.tables.map((t) => [t.id, t]));
  const colName = (tableId: string, colId: string) =>
    byId.get(tableId)?.columns.find((c) => c.id === colId)?.name ?? '';
  const parts: string[] = [];
  if (options.dropExisting) {
    if (dialect === 'mysql' || dialect === 'sqlite')
      parts.push(
        dialect === 'mysql' ? 'SET FOREIGN_KEY_CHECKS = 0;' : 'PRAGMA foreign_keys = OFF;',
      );
    for (const t of [...order].reverse()) parts.push(`DROP TABLE IF EXISTS ${q(t.name)};`);
    if (dialect === 'mysql' || dialect === 'sqlite')
      parts.push(dialect === 'mysql' ? 'SET FOREIGN_KEY_CHECKS = 1;' : 'PRAGMA foreign_keys = ON;');
    parts.push('');
  }
  const later: string[] = [];
  for (const t of order) {
    const pk = t.columns.filter((c) => c.primaryKey);
    const sqliteRowid =
      dialect === 'sqlite' && pk.length === 1 && pk[0]?.identity === true && pk[0].type !== 'BIGINT'
        ? pk[0]
        : null;
    const lines = t.columns.map((c) => {
      let line = `  ${q(c.name)} ${typeSql(c, dialect)}`;
      if (c === sqliteRowid) return `${line} PRIMARY KEY AUTOINCREMENT`;
      if (c.identity) {
        if (dialect === 'mssql') line += ' IDENTITY(1,1)';
        else if (dialect === 'postgresql') line += ' GENERATED BY DEFAULT AS IDENTITY';
        else if (dialect === 'mysql') line += ' AUTO_INCREMENT';
        else
          notes.push(
            `SQLite only auto-increments a single INTEGER primary key; ${t.name}.${c.name} is a plain column.`,
          );
      }
      if (!c.nullable || c.primaryKey) line += ' NOT NULL';
      if (c.unique && !c.primaryKey) line += ' UNIQUE';
      if (c.defaultValue.trim()) line += ` DEFAULT ${c.defaultValue.trim()}`;
      return line;
    });
    if (pk.length && !sqliteRowid)
      lines.push(
        `  CONSTRAINT ${q(`pk_${constraintName(t.name)}`)} PRIMARY KEY (${pk.map((c) => q(c.name)).join(', ')})`,
      );
    for (const r of d.relations.filter((x) => x.fromTable === t.id)) {
      const target = byId.get(r.toTable);
      if (!target) continue;
      const fc = colName(r.fromTable, r.fromColumn);
      const fk = `CONSTRAINT ${q(`fk_${constraintName(t.name)}_${constraintName(fc)}`)} FOREIGN KEY (${q(fc)}) REFERENCES ${q(target.name)} (${q(colName(r.toTable, r.toColumn))})${r.onDelete !== 'NO ACTION' ? ` ON DELETE ${r.onDelete}` : ''}`;
      if (deferred.has(r.id) && dialect !== 'sqlite')
        later.push(`ALTER TABLE ${q(t.name)} ADD ${fk};`);
      else lines.push(`  ${fk}`);
    }
    parts.push(
      `CREATE TABLE ${qualifiedName(t.name, null, dialect, options.quoteAll ?? false)} (\n${lines.join(',\n')}\n)${dialect === 'mysql' ? ' ENGINE=InnoDB' : ''};`,
      '',
    );
  }
  if (later.length)
    parts.push('-- Circular references are added after every table exists.', ...later, '');
  return { sql: `${parts.join('\n').trimEnd()}\n`, notes: [...new Set(notes)] };
}

/** Reads a design file (JSON); prototype-pollution safe and validated. */
export function parseDesign(text: string): SchemaDesign {
  let raw: unknown;
  try {
    raw = safeJsonParse(text);
  } catch (error) {
    throw new ParseError(
      `This is not a valid design file: ${error instanceof Error ? error.message : 'invalid JSON'}.`,
    );
  }
  const result = designSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ValidationError(
      `This is not a valid design file${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}.`,
    );
  }
  return result.data;
}
