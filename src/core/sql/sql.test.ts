import { describe, expect, it } from 'vitest';
import { ParseError, ValidationError } from '../errors/AppError';
import { normalizeSql, stripSqlComments } from './compare';
import { quoteIdentifier } from './dialects';
import { formatSql } from './format';
import {
  generateDelete,
  generateInsert,
  generateSelect,
  generateUpdate,
  literalFor,
  primaryKeyConditions,
} from './generators';
import { sqlLiteral, sqlStringLiteral } from './literals';
import { parseTables, type TableModel } from './schema';
import { tablesToCSharp, tablesToTypeScript } from './toCode';
import { minifySql, splitStatements } from './tokenize';
import { validateSql } from './validate';

const ORDERS_PG = `CREATE TABLE customers (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE);
CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  note TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  external_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ratio DOUBLE PRECISION
);`;

describe('formatting and minifying', () => {
  it('formats per dialect with options', () => {
    expect(formatSql('select a,b from t where x=1', 'postgresql')).toBe(
      'SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1\n',
    );
    expect(formatSql('select [a] from [t]', 'mssql', { keywordCase: 'lower', indent: 4 })).toBe(
      'select\n    [a]\nfrom\n    [t]\n',
    );
    expect(formatSql('select a from t', 'mysql', { indent: 'tab' })).toBe(
      'SELECT\n\ta\nFROM\n\tt\n',
    );
  });

  it('reports formatting errors with a position', () => {
    try {
      formatSql("select a from t where 'open", 'postgresql');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).line).toBe(1);
      expect((e as ParseError).column).toBe(23);
    }
    expect(() => formatSql('  ', 'sqlite')).toThrow(ValidationError);
  });

  it('minifies without touching strings, quoted identifiers or operators', () => {
    const sql = `-- header
SELECT  a ,  'x  -- not a comment' AS "my  col" , b - -1 /* inline */
FROM   t   -- trailing
WHERE  c = $tag$ a;  b $tag$ ;`;
    expect(minifySql(sql, 'postgresql')).toBe(
      `SELECT a,'x  -- not a comment' AS "my  col",b - -1 FROM t WHERE c = $tag$ a;  b $tag$;`,
    );
    expect(minifySql("select 1 # comment\n, 'a\\'b' from `t t`", 'mysql')).toBe(
      "select 1,'a\\'b' from `t t`",
    );
    expect(minifySql('SELECT /*+ INDEX(t i) */ a FROM [my table]', 'mssql')).toBe(
      'SELECT /*+ INDEX(t i) */ a FROM [my table]',
    );
    expect(minifySql('SELECT /*+ x */ a', 'mssql', { keepHints: false })).toBe('SELECT a');
    expect(minifySql('select count ( * ) from t', 'sqlite')).toBe('select count (*) from t');
  });

  it('splits scripts into statements (strings, comments and GO batches)', () => {
    expect(
      splitStatements("select ';' ; -- only a comment;\nselect 2;", 'postgresql').map(
        (s) => s.text,
      ),
    ).toEqual(["select ';'", '-- only a comment;\nselect 2']);
    const go = splitStatements('select 1\nGO\nselect 2\ngo  -- end\n', 'mssql');
    expect(go.map((s) => s.text)).toEqual(['select 1', 'select 2']);
    expect(go[1]?.offset).toBe(12);
  });
});

describe('validation', () => {
  it('summarizes valid scripts and warns about risky statements', async () => {
    const r = await validateSql(
      'SELECT * FROM users;\nUPDATE users SET active = 0;\nDELETE FROM logs WHERE id < 10;',
      'postgresql',
    );
    expect(r.valid).toBe(true);
    expect(r.statements.map((s) => [s.type, s.tables, s.line])).toEqual([
      ['select', ['users'], 1],
      ['update', ['users'], 2],
      ['delete', ['logs'], 3],
    ]);
    expect(r.issues).toEqual([
      expect.objectContaining({
        severity: 'info',
        line: 1,
        message: expect.stringMatching(/SELECT \*/) as string,
      }),
      expect.objectContaining({
        severity: 'warning',
        line: 2,
        message: 'UPDATE without WHERE changes every row of the table.',
      }),
    ]);
  });

  it('reports syntax errors at their position in the whole script, per dialect', async () => {
    const r = await validateSql('SELECT 1;\n\nSELECT a FORM t;', 'mysql');
    expect(r.valid).toBe(false);
    const err = r.issues.find((i) => i.severity === 'error');
    expect(err).toMatchObject({ line: 3 });
    expect(err?.message).toMatch(/^Unexpected/);
    expect((await validateSql('SELECT TOP 5 [Name] FROM [dbo].[Users]', 'mssql')).valid).toBe(true);
    expect((await validateSql('SELECT x FROM t LIMIT 5', 'sqlite')).valid).toBe(true);
    expect((await validateSql('SELECT x FROM t WHERE', 'sqlite')).issues[0]?.message).toMatch(
      /end of the statement/,
    );
    await expect(validateSql(' ', 'sqlite')).rejects.toThrow(ValidationError);
  });
});

describe('CREATE TABLE parsing and code generation', () => {
  it('extracts tables, keys, identities, defaults and foreign keys (PostgreSQL)', () => {
    const [customers, items] = parseTables(ORDERS_PG, 'postgresql');
    expect(customers).toMatchObject({ name: 'customers', primaryKey: ['id'] });
    expect(customers?.columns[1]).toMatchObject({
      name: 'email',
      type: 'VARCHAR',
      length: 255,
      nullable: false,
      unique: true,
    });
    expect(items?.columns.map((c) => [c.name, c.type, c.nullable, c.identity])).toEqual([
      ['id', 'BIGSERIAL', false, true],
      ['customer_id', 'INT', false, false],
      ['total', 'NUMERIC', false, false],
      ['note', 'TEXT', true, false],
      ['is_paid', 'BOOLEAN', false, false],
      ['external_id', 'UUID', true, false],
      ['created_at', 'TIMESTAMPTZ', false, false],
      ['ratio', 'DOUBLE PRECISION', true, false],
    ]);
    expect(items?.columns[2]).toMatchObject({ length: 10, scale: 2, defaultValue: '0' });
    expect(items?.foreignKeys).toEqual([
      {
        columns: ['customer_id'],
        refTable: 'customers',
        refSchema: null,
        refColumns: ['id'],
        onDelete: 'cascade',
      },
    ]);
  });

  it('handles SQL Server, MySQL and SQLite syntax and table constraints', () => {
    const [t] = parseTables(
      'CREATE TABLE [dbo].[Users] ([Id] INT IDENTITY(1,1) NOT NULL, [Name] NVARCHAR(100) NULL, [TeamId] INT NOT NULL, CONSTRAINT [PK_Users] PRIMARY KEY ([Id]), CONSTRAINT [FK_Team] FOREIGN KEY ([TeamId]) REFERENCES [dbo].[Teams]([Id]))',
      'mssql',
    );
    expect(t).toMatchObject({ name: 'Users', schema: 'dbo', primaryKey: ['Id'] });
    expect(t?.columns[0]).toMatchObject({ identity: true, primaryKey: true, nullable: false });
    expect(t?.foreignKeys[0]).toMatchObject({
      columns: ['TeamId'],
      refTable: 'Teams',
      refSchema: 'dbo',
      refColumns: ['Id'],
    });
    const [m] = parseTables(
      'CREATE TABLE `events` (`id` INT AUTO_INCREMENT PRIMARY KEY, `payload` JSON)',
      'mysql',
    );
    expect(m?.columns.map((c) => [c.name, c.identity, c.type])).toEqual([
      ['id', true, 'INT'],
      ['payload', false, 'JSON'],
    ]);
    const [s] = parseTables(
      'CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL); SELECT 1;',
      'sqlite',
    );
    expect(s?.columns[1]).toMatchObject({ name: 'body', nullable: false });
  });

  it('tolerates vendor options, indexes, checks and comments', () => {
    const [m] = parseTables(
      `CREATE TABLE IF NOT EXISTS shop.products (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT, -- surrogate key
        sku VARCHAR(32) CHARACTER SET ascii NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        price DECIMAL(10, 2) CHECK (price >= 0),
        PRIMARY KEY (id),
        UNIQUE KEY uq_sku (sku),
        KEY idx_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      'mysql',
    );
    expect(m).toMatchObject({ name: 'products', schema: 'shop', primaryKey: ['id'] });
    expect(
      m?.columns.map((c) => [
        c.name,
        c.type,
        c.length,
        c.nullable,
        c.identity,
        c.unique,
        c.defaultValue,
      ]),
    ).toEqual([
      ['id', 'INT', null, false, true, false, null],
      ['sku', 'VARCHAR', 32, false, false, true, null],
      ['active', 'TINYINT', 1, false, false, false, '1'],
      ['price', 'DECIMAL', 10, true, false, false, null],
    ]);
    const [pg] = parseTables(
      'CREATE TABLE "public"."Users" ("Id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "Name" character varying(80), "At" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL)',
      'postgresql',
    );
    expect(
      pg?.columns.map((c) => [c.name, c.type, c.identity, c.nullable, c.defaultValue]),
    ).toEqual([
      ['Id', 'INTEGER', true, false, null],
      ['Name', 'CHARACTER VARYING', false, true, null],
      ['At', 'TIMESTAMP WITH TIME ZONE', false, false, 'CURRENT_TIMESTAMP'],
    ]);
    const [ms] = parseTables(
      'CREATE TABLE [Sales].[Order Lines] ([Line Id] BIGINT NOT NULL CONSTRAINT [DF_X] DEFAULT (NEXT VALUE FOR seq), [Notes] NVARCHAR(MAX) NULL, CONSTRAINT [PK] PRIMARY KEY CLUSTERED ([Line Id] ASC)) ON [PRIMARY]\nGO',
      'mssql',
    );
    expect(ms).toMatchObject({ name: 'Order Lines', schema: 'Sales', primaryKey: ['Line Id'] });
    expect(ms?.columns[0]).toMatchObject({ defaultValue: 'NEXT VALUE FOR seq', primaryKey: true });
    expect(ms?.columns[1]).toMatchObject({ type: 'NVARCHAR', length: null, nullable: true });
  });

  it('rejects scripts without CREATE TABLE and reports parse errors with positions', () => {
    expect(() => parseTables('SELECT 1', 'postgresql')).toThrow('No CREATE TABLE statement found.');
    const error = (() => {
      try {
        return parseTables('SELECT 1;\nCREATE TABLE t (id INT, x INT', 'postgresql');
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ParseError);
    expect((error as ParseError).line).toBe(2);
  });

  it('generates C# entities with data annotations and correct types', () => {
    const tables = parseTables(ORDERS_PG, 'postgresql');
    const { code, files } = tablesToCSharp(tables, {
      namespace: 'Shop.Data',
      fileScopedNamespace: true,
      nullableReferenceTypes: true,
      typeKind: 'class',
      dateType: 'DateTimeOffset',
      requiredMembers: false,
      annotations: true,
    });
    expect(code).toContain('using System.ComponentModel.DataAnnotations.Schema;');
    expect(code).toContain('[Table("order_items")]\npublic class OrderItem');
    expect(code).toContain(
      '    [Key]\n    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]\n    [Column("id")]\n    public long Id { get; set; }',
    );
    expect(code).toContain('    [Column("total")]\n    public decimal Total { get; set; }');
    expect(code).toContain('public string? Note { get; set; }');
    expect(code).toContain('public bool IsPaid { get; set; }');
    expect(code).toContain('public Guid? ExternalId { get; set; }');
    expect(code).toContain('public DateTimeOffset CreatedAt { get; set; }');
    expect(code).toContain('public double? Ratio { get; set; }');
    expect(code).toContain(
      '    [Required]\n    [MaxLength(255)]\n    public string Email { get; set; } = string.Empty;',
    );
    expect(files.map((f) => f.path)).toEqual(['Customer.cs', 'OrderItem.cs']);
  });

  it('generates TypeScript types with column or camelCase names', () => {
    const tables = parseTables(ORDERS_PG, 'postgresql');
    const out = tablesToTypeScript(tables, {
      declaration: 'interface',
      readonly: false,
      dateType: 'string',
      exportTypes: true,
      propertyNames: 'camel',
    });
    expect(out.code).toContain(
      'export interface OrderItem {\n  id: number;\n  customerId: number;\n  total: number;\n  note: string | null;\n  isPaid: boolean;',
    );
    const raw = tablesToTypeScript(tables, {
      declaration: 'type',
      readonly: true,
      dateType: 'Date',
      exportTypes: false,
      propertyNames: 'column',
    });
    expect(raw.code).toContain(
      'type OrderItem = {\n  readonly id: number;\n  readonly customer_id: number;',
    );
    expect(raw.code).toContain('readonly created_at: Date;');
  });
});

const USERS: TableModel = {
  name: 'users',
  schema: null,
  primaryKey: ['id'],
  foreignKeys: [
    {
      columns: ['team_id'],
      refTable: 'teams',
      refSchema: null,
      refColumns: ['id'],
      onDelete: null,
    },
  ],
  columns: [
    {
      name: 'id',
      type: 'INT',
      length: null,
      scale: null,
      nullable: false,
      primaryKey: true,
      identity: true,
      unique: false,
      defaultValue: null,
    },
    {
      name: 'name',
      type: 'VARCHAR',
      length: 100,
      scale: null,
      nullable: false,
      primaryKey: false,
      identity: false,
      unique: false,
      defaultValue: null,
    },
    {
      name: 'team_id',
      type: 'INT',
      length: null,
      scale: null,
      nullable: true,
      primaryKey: false,
      identity: false,
      unique: false,
      defaultValue: null,
    },
    {
      name: 'active',
      type: 'BOOLEAN',
      length: null,
      scale: null,
      nullable: false,
      primaryKey: false,
      identity: false,
      unique: false,
      defaultValue: 'true',
    },
  ],
};
const common = { table: USERS, valueMode: 'parameters' as const, quoteAll: false };

describe('statement generators', () => {
  it('builds SELECTs with joins, conditions and dialect-specific paging and parameters', () => {
    const spec = {
      ...common,
      dialect: 'postgresql' as const,
      columns: ['id', 'name'],
      distinct: false,
      count: false,
      where: [
        { column: 'name', operator: 'LIKE' as const, value: '' },
        { column: 'active', operator: '=' as const, value: '' },
      ],
      whereJoin: 'AND' as const,
      orderBy: [{ column: 'name', direction: 'ASC' as const }],
      limit: 20,
      offset: 40,
      joins: [],
    };
    expect(generateSelect(spec).sql).toBe(
      'SELECT \n  id,\n  name\nFROM users\nWHERE name LIKE $1\n  AND active = $2\nORDER BY name ASC\nLIMIT 20\nOFFSET 40;\n',
    );
    const ms = generateSelect({ ...spec, dialect: 'mssql' });
    expect(ms.sql).toContain('WHERE name LIKE @name\n  AND active = @active');
    expect(ms.sql).toContain('ORDER BY name ASC\nOFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;');
    expect(generateSelect({ ...spec, dialect: 'mssql', offset: null }).sql).toMatch(
      /^SELECT TOP \(20\) /,
    );
    expect(generateSelect({ ...spec, dialect: 'mysql', where: [] }).parameters).toEqual([]);
    const joined = generateSelect({
      ...spec,
      dialect: 'sqlite',
      limit: null,
      offset: null,
      where: [{ column: 'id', operator: 'IN', value: '1, 2' }],
      valueMode: 'literals',
      joins: [{ foreignKey: USERS.foreignKeys[0] as never, type: 'LEFT' }],
    });
    expect(joined.sql).toBe(
      'SELECT \n  u.id,\n  u.name\nFROM users u\nLEFT JOIN teams t ON t.id = u.team_id\nWHERE u.id IN (1, 2)\nORDER BY u.name ASC;\n',
    );
  });

  it('builds INSERTs from JSON or CSV with batching, escaping and upserts', () => {
    const base = {
      ...common,
      columns: [],
      skipIdentity: true,
      rowsPerStatement: 2,
      onConflict: 'none' as const,
    };
    const json = generateInsert({
      ...base,
      dialect: 'mysql',
      data: {
        format: 'json',
        text: '[{"name":"O\'Neil \\\\ x","active":true,"extra":1},{"name":"B","team_id":3},{"name":"C"}]',
      },
    });
    expect(json.sql).toBe(
      "INSERT INTO users (name, team_id, active)\nVALUES\n  ('O''Neil \\\\ x', NULL, TRUE),\n  ('B', 3, NULL);\n\nINSERT INTO users (name, team_id, active)\nVALUES\n  ('C', NULL, NULL);\n",
    );
    expect(json.notes).toEqual(['Ignored fields not in the table: extra.']);
    const csv = generateInsert({
      ...base,
      dialect: 'mssql',
      rowsPerStatement: 100,
      data: { format: 'csv', text: 'name,active\nÅsa,1\n' },
    });
    expect(csv.sql).toContain("(N'Åsa', NULL, 1)");
    const upsert = generateInsert({
      ...base,
      dialect: 'postgresql',
      columns: ['id', 'name'],
      onConflict: 'update',
      data: null,
    });
    expect(upsert.sql).toBe(
      'INSERT INTO users (id, name)\nVALUES ($1, $2)\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;\n',
    );
    expect(
      generateInsert({ ...base, dialect: 'mysql', onConflict: 'ignore', data: null }).sql,
    ).toMatch(/^INSERT IGNORE INTO/);
    const sample = generateInsert({
      ...base,
      dialect: 'sqlite',
      valueMode: 'literals',
      data: null,
    });
    expect(sample.sql).toBe(
      "INSERT INTO users (name, team_id, active)\nVALUES ('name', 0, DEFAULT);\n",
    );
    expect(() =>
      generateInsert({ ...base, dialect: 'sqlite', data: { format: 'json', text: '[1]' } }),
    ).toThrow(/array of objects/);
  });

  it('refuses UPDATE/DELETE without WHERE unless allowed, and supports safe deletes', () => {
    const where = primaryKeyConditions(USERS);
    const update = generateUpdate({
      ...common,
      dialect: 'mssql',
      set: [{ column: 'name', value: '' }],
      where,
      whereJoin: 'AND',
      allowAllRows: false,
    });
    expect(update.sql).toBe('UPDATE users\nSET name = @name\nWHERE id = @id;\n');
    expect(() =>
      generateUpdate({
        ...common,
        dialect: 'mssql',
        set: [{ column: 'name', value: '' }],
        where: [],
        whereJoin: 'AND',
        allowAllRows: false,
      }),
    ).toThrow(/Add a WHERE condition/);
    const literal = generateUpdate({
      ...common,
      valueMode: 'literals',
      dialect: 'postgresql',
      set: [{ column: 'active', value: 'false' }],
      where: [{ column: 'id', operator: '=', value: '7' }],
      whereJoin: 'AND',
      allowAllRows: false,
    });
    expect(literal.sql).toBe('UPDATE users\nSET active = FALSE\nWHERE id = 7;\n');
    const del = generateDelete({
      ...common,
      dialect: 'postgresql',
      where,
      whereJoin: 'AND',
      allowAllRows: false,
      previewCount: true,
      transaction: true,
      softDeleteColumn: null,
    });
    expect(del.sql).toBe(
      'BEGIN;\n\n-- Rows that will be deleted:\nSELECT COUNT(*) AS affected\nFROM users\nWHERE id = $1;\n\nDELETE FROM users\nWHERE id = $1;\n\n-- Check the result, then run one of:\n-- COMMIT;\n-- ROLLBACK;\n',
    );
    const soft = generateDelete({
      ...common,
      dialect: 'mssql',
      where,
      whereJoin: 'AND',
      allowAllRows: false,
      previewCount: false,
      transaction: false,
      softDeleteColumn: 'deleted_at',
    });
    expect(soft.sql).toBe('UPDATE users\nSET deleted_at = SYSUTCDATETIME()\nWHERE id = @id;\n');
    expect(() =>
      generateDelete({
        ...common,
        dialect: 'mysql',
        where: [],
        whereJoin: 'AND',
        allowAllRows: false,
        previewCount: false,
        transaction: false,
        softDeleteColumn: null,
      }),
    ).toThrow(ValidationError);
    expect(
      generateDelete({
        ...common,
        dialect: 'mysql',
        where: [],
        whereJoin: 'AND',
        allowAllRows: true,
        previewCount: false,
        transaction: false,
        softDeleteColumn: null,
      }).notes,
    ).toEqual(['This DELETE removes every row.']);
  });
});

describe('literals, quoting and compare', () => {
  it('escapes literals per dialect', () => {
    expect(sqlStringLiteral("it's", 'postgresql')).toBe("'it''s'");
    expect(sqlStringLiteral("a\\'b\0", 'mysql')).toBe("'a\\\\''b\\0'");
    expect(sqlStringLiteral('é', 'mssql')).toBe("N'é'");
    expect(sqlLiteral({ a: 1 }, 'sqlite')).toBe('\'{"a":1}\'');
    expect(sqlLiteral(Number.NaN, 'sqlite')).toBe('NULL');
    expect(literalFor('42', USERS.columns[0], 'mssql')).toBe('42');
    expect(literalFor('42', USERS.columns[1], 'mssql')).toBe("N'42'");
    expect(literalFor('true', USERS.columns[3], 'mssql')).toBe('1');
    expect(literalFor('null', USERS.columns[1], 'mssql')).toBe('NULL');
  });

  it('quotes identifiers only when needed', () => {
    expect(quoteIdentifier('order', 'postgresql')).toBe('"order"');
    expect(quoteIdentifier('first name', 'mssql')).toBe('[first name]');
    expect(quoteIdentifier('a]b', 'mssql')).toBe('[a]]b]');
    expect(quoteIdentifier('id', 'mysql', true)).toBe('`id`');
    expect(quoteIdentifier('user_id', 'sqlite')).toBe('user_id');
  });

  it('normalizes scripts so only real differences remain', () => {
    expect(normalizeSql('select a -- c\nfrom t', 'postgresql')).toBe(
      normalizeSql('SELECT   a FROM t', 'postgresql'),
    );
    expect(stripSqlComments("select '--x' /* y */ -- z", 'postgresql')).toBe("select '--x'   ");
  });
});
