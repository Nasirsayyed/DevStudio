import { screen, waitFor, within } from '@testing-library/react';
import { saveAs } from 'file-saver';
import initSqlJs from 'sql.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/services/db/database';
import type * as SqliteClientModule from '@/services/sqlite/sqliteClient';
import { savedQueriesRepository } from '@/services/db/repositories/savedQueriesRepository';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

// jsdom has no Worker: run the same engine in process with Node's sql.js.
vi.mock('@/services/sqlite/sqliteClient', async (importOriginal) => {
  const actual = await importOriginal<typeof SqliteClientModule>();
  const { createSqliteEngine } = await import('@/services/sqlite/engine');
  return {
    ...actual,
    createSqliteConnection: () =>
      new actual.InlineSqliteConnection(createSqliteEngine(() => initSqlJs())),
  };
});

beforeEach(async () => {
  await resetAppState();
  vi.mocked(saveAs).mockClear();
});

describe('SQLite Playground', () => {
  it('runs scripts, shows result sets and the schema, and reports errors', async () => {
    const { user } = renderApp('/sql/playground');
    await user.click(await screen.findByRole('button', { name: 'Load sample' }));
    await user.click(screen.getByRole('button', { name: 'Run' }));
    const result = await screen.findByRole('region', { name: 'Result 1' }, { timeout: 5000 });
    expect(within(result).getByText(/Result 1: 3 rows/)).toBeInTheDocument();
    const grid = within(result).getByRole('grid', { name: 'Result 1' });
    expect(within(grid).getByText('Ahmed')).toBeInTheDocument();
    expect(within(grid).getByText('200.5')).toBeInTheDocument();
    expect(screen.getByText(/3 rows changed · 4 rows changed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Database')).toHaveTextContent('unsaved changes');

    await user.click(screen.getByRole('tab', { name: 'Schema (2)' }));
    const tables = screen.getByRole('list', { name: 'Tables and views' });
    expect(within(tables).getByText('customers')).toBeInTheDocument();
    expect(tables).toHaveTextContent('3 rows');
    await user.click(within(tables).getByText('orders'));
    expect(useSqlWorkspaceStore.getState().playground).toBe('SELECT * FROM "orders" LIMIT 100;');

    await setEditorText(
      user,
      screen.getByRole('textbox', { name: 'SQL script' }),
      'SELECT 1;\nSELECT * FROM nope;',
    );
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no such table: nope');
    expect(screen.getByRole('alert')).toHaveTextContent('The 1 statement(s) before it ran.');
  });

  it('exports results as CSV, saves the database in the browser and reopens it', async () => {
    const { user } = renderApp('/sql/playground');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'SQL script' }),
      "CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('=1+1'), ('plain'); SELECT v FROM t;",
    );
    await user.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByRole('region', { name: 'Result 1' }, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Download Result 1 as CSV' }));
    const [blob, name] = vi.mocked(saveAs).mock.calls[0] as [Blob, string];
    expect(name).toBe('result-1.csv');
    // Formula injection is neutralized in exported CSV.
    expect(await blob.text()).toBe('v\r\n"\'=1+1"\r\nplain');

    await user.click(screen.getByRole('button', { name: 'Database' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save in this browser…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save database in this browser' });
    const field = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.type(field, 'Scratch');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Saved "Scratch"/)).toBeInTheDocument();
    const [saved] = await db.savedQueries.toArray();
    expect(saved).toMatchObject({ name: 'Scratch', kind: 'sqliteDb', dialect: 'sqlite' });
    expect(typeof saved?.content).toBe('object');
    expect(ArrayBuffer.isView(saved?.content)).toBe(true);
    expect(screen.getByLabelText('Database')).toHaveTextContent(/^Scratch$/);

    await user.click(await screen.findByRole('button', { name: 'Database' }));
    await user.click(screen.getByRole('menuitem', { name: 'New empty database' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Schema (0)' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Database' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open saved database…' }));
    await user.click(
      await within(await screen.findByRole('dialog', { name: 'Open saved database' })).findByText(
        'Scratch',
      ),
    );
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Schema (1)' })).toBeInTheDocument();
    });
  });
});

describe('Schema Designer', () => {
  it('designs tables and relationships and generates DDL for the dialect', async () => {
    const { user } = renderApp('/sql/schema-designer');
    await user.click(await screen.findByRole('button', { name: 'Add table' }));
    const name = screen.getByRole('textbox', { name: 'Table name' });
    await user.clear(name);
    await user.type(name, 'authors');
    await user.click(screen.getByRole('button', { name: 'Add column' }));
    const colName = screen.getByRole('textbox', { name: 'Name of column 2' });
    await user.clear(colName);
    await user.type(colName, 'name');
    await user.click(screen.getByRole('checkbox', { name: 'name is required' }));

    await user.click(screen.getByRole('button', { name: 'Add table' }));
    const second = screen.getByRole('textbox', { name: 'Table name' });
    await user.clear(second);
    await user.type(second, 'books');
    await user.click(screen.getByRole('button', { name: 'Add column' }));
    const fk = screen.getByRole('textbox', { name: 'Name of column 2' });
    await user.clear(fk);
    await user.type(fk, 'author_id');
    await user.click(screen.getByRole('combobox', { name: 'Type of author_id' }));
    await user.click(screen.getByRole('option', { name: 'INTEGER' }));

    const rel = screen.getByRole('group', { name: 'Relationships' });
    await user.click(within(rel).getByRole('combobox', { name: 'Column' }));
    await user.click(screen.getByRole('option', { name: 'author_id' }));
    await user.click(within(rel).getByRole('combobox', { name: 'References table' }));
    await user.click(screen.getByRole('option', { name: 'authors' }));
    await user.click(within(rel).getByRole('combobox', { name: 'On delete' }));
    await user.click(screen.getByRole('option', { name: 'CASCADE' }));
    await user.click(within(rel).getByRole('button', { name: 'Add relationship' }));
    expect(rel).toHaveTextContent('books.author_id → authors.id (ON DELETE CASCADE)');

    await user.click(screen.getByRole('tab', { name: 'DDL' }));
    const ddl = () =>
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Generated DDL' }).value;
    expect(ddl()).toContain(
      'CREATE TABLE authors (\n  id INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,\n  name VARCHAR(255) NOT NULL,',
    );
    expect(ddl()).toContain('FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE');
    await user.click(screen.getByRole('combobox', { name: 'Dialect' }));
    await user.click(screen.getByRole('option', { name: 'SQLite' }));
    expect(ddl()).toContain('  id INTEGER PRIMARY KEY AUTOINCREMENT,');
    await user.click(screen.getByRole('button', { name: 'Run in SQLite Playground' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'SQLite Playground' }),
    ).toBeInTheDocument();
    expect(useSqlWorkspaceStore.getState().playground).toContain('CREATE TABLE books');
  });

  it('imports CREATE TABLE statements, reports problems and saves designs', async () => {
    const { user, router } = renderApp('/sql/schema-designer');
    await user.click(await screen.findByRole('button', { name: 'Import CREATE TABLE…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import CREATE TABLE statements' });
    await user.click(within(dialog).getByRole('button', { name: 'Use the sample' }));
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Imported 2 tables.')).toBeInTheDocument();
    expect(screen.getByText('2 tables · 1 relationships')).toBeInTheDocument();

    // Introduce a problem: a duplicate table name.
    const name = await screen.findByRole('textbox', { name: 'Table name' });
    await user.clear(name);
    await user.type(name, 'orders');
    await user.click(screen.getByRole('tab', { name: /Problems \(\d+\)/ }));
    expect(screen.getByRole('list', { name: 'Design problems' })).toHaveTextContent(
      'There are several tables named "orders".',
    );
    await user.click(screen.getByRole('tab', { name: 'DDL' }));
    expect(
      within(screen.getByRole('region', { name: 'Schema output' })).getByRole('alert'),
    ).toHaveTextContent('There are several tables named "orders".');
    await user.clear(name);
    await user.type(name, 'customers');

    await user.click(screen.getByRole('button', { name: 'Design' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save in this browser…' }));
    const save = await screen.findByRole('dialog', { name: 'Save design' });
    await user.click(within(save).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved "My schema"')).toBeInTheDocument();
    const [saved] = await db.savedQueries.toArray();
    expect(saved).toMatchObject({ kind: 'schema', name: 'My schema' });

    // Palette links (/sql/formatter?query=…) redirect designs to the designer.
    useSqlWorkspaceStore.setState({ design: { version: 1, tables: [], relations: [] } });
    const id = saved?.id ?? '';
    router.navigate(`/sql/formatter?query=${id}`).catch(() => undefined);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sql/schema-designer');
    });
    await waitFor(() => {
      expect(useSqlWorkspaceStore.getState().design.tables).toHaveLength(2);
    });
    expect(router.state.location.search).toBe('');
    expect((await savedQueriesRepository.list('schema')).length).toBe(1);
  });
});
