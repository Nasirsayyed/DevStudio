import type { SqlDialect } from '@/types/entities';

export const SAMPLE_QUERY = `select c.id, c.email, count(o.id) as orders, sum(o.total) as revenue from customers c left join orders o on o.customer_id = c.id and o.status <> 'cancelled' where c.created_at >= '2024-01-01' and (c.country = 'DE' or c.country = 'AT') group by c.id, c.email having count(o.id) > 2 order by revenue desc;
update customers set last_seen = current_timestamp where id = 42;`;

const SCHEMA: Record<SqlDialect, string> = {
  postgresql: `CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120),
  country CHAR(2) NOT NULL DEFAULT 'US',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  total NUMERIC(10, 2) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  external_id UUID,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  mssql: `CREATE TABLE [dbo].[Customers] (
  [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [Email] NVARCHAR(255) NOT NULL UNIQUE,
  [FullName] NVARCHAR(120) NULL,
  [Country] CHAR(2) NOT NULL DEFAULT 'US',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE [dbo].[Orders] (
  [Id] BIGINT IDENTITY(1,1) NOT NULL,
  [CustomerId] INT NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'new',
  [Total] DECIMAL(10, 2) NOT NULL,
  [Paid] BIT NOT NULL DEFAULT 0,
  [ExternalId] UNIQUEIDENTIFIER NULL,
  [PlacedAt] DATETIMEOFFSET NOT NULL,
  CONSTRAINT [PK_Orders] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Orders_Customers] FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customers] ([Id]) ON DELETE CASCADE
);
`,
  mysql: `CREATE TABLE customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120),
  country CHAR(2) NOT NULL DEFAULT 'US',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE orders (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  total DECIMAL(10, 2) NOT NULL,
  paid TINYINT(1) NOT NULL DEFAULT 0,
  placed_at DATETIME NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB;
`,
  sqlite: `CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new',
  total NUMERIC NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  placed_at TEXT NOT NULL
);
`,
};

export function sampleSchema(dialect: SqlDialect): string {
  return SCHEMA[dialect];
}

export const SAMPLE_ROWS = `[
  { "email": "ahmed@example.com", "full_name": "Ahmed O'Neil", "country": "DE" },
  { "email": "lea@example.com", "full_name": "Léa Martin", "country": "FR" },
  { "email": "kim@example.com", "full_name": null, "country": "KR" }
]`;
