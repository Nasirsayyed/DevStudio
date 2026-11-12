import { act, screen, waitFor, within } from '@testing-library/react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/services/db/database';
import { savedQueriesRepository } from '@/services/db/repositories/savedQueriesRepository';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

const output = () => screen.findByRole('textbox', { name: 'Output' });
const value = async (name: string) =>
  (await screen.findByRole<HTMLTextAreaElement>('textbox', { name })).value;

async function chooseDialect(user: ReturnType<typeof renderApp>['user'], label: string) {
  await user.click(screen.getByRole('combobox', { name: 'Dialect' }));
  await user.click(screen.getByRole('option', { name: label }));
}

beforeEach(async () => {
  await resetAppState();
  vi.mocked(saveAs).mockClear();
});

describe('SQL formatter, minifier, validator and compare', () => {
  it('formats with options and shares the script and dialect with the minifier', async () => {
    const { user, router } = renderApp('/sql/formatter');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'SQL input' }),
      'select a,b from t where x=1',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue('SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1\n');
    });
    await user.click(screen.getByRole('combobox', { name: 'Keywords' }));
    await user.click(screen.getByRole('option', { name: 'lower' }));
    await waitFor(async () => {
      expect(await output()).toHaveValue('select\n  a,\n  b\nfrom\n  t\nwhere\n  x = 1\n');
    });
    await chooseDialect(user, 'SQL Server (T-SQL)');

    await act(() => router.navigate('/sql/minifier'));
    await waitFor(async () => {
      expect(await output()).toHaveValue('select a,b from t where x=1');
    });
    expect(screen.getByRole('combobox', { name: 'Dialect' })).toHaveTextContent(
      'SQL Server (T-SQL)',
    );
    expect(screen.getByText('−0%')).toBeInTheDocument();
  });

  it('marks formatting errors in the editor', async () => {
    const { user } = renderApp('/sql/formatter');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'SQL input' }),
      "select a from t where x = 'open",
    );
    expect(await screen.findByRole('list', { name: 'SQL input problems' })).toHaveTextContent(
      'error 1:27',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/unexpected/i);
  });

  it('validates statements, lists problems and jumps to them', async () => {
    const { user } = renderApp('/sql/validator');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'SQL input' }),
      'SELECT id FROM users;\nDELETE FROM logs;\nSELECT a FORM t;',
    );
    const problems = await screen.findByRole('list', { name: 'Problems' }, { timeout: 5000 });
    expect(problems).toHaveTextContent('DELETE without WHERE changes every row of the table.');
    expect(problems).toHaveTextContent('Line 3');
    expect(screen.getByText('1 error(s)')).toBeInTheDocument();
    const statements = screen.getByRole('table', { name: 'Statements' });
    expect(within(statements).getAllByRole('row')).toHaveLength(3);
    await user.click(within(problems).getByText(/^Unexpected/));
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-reveal-line', '3');
  });

  it('compares scripts after normalizing formatting and comments', async () => {
    const { user } = renderApp('/sql/compare');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Original SQL' }),
      'select a -- note\nfrom t',
    );
    await setEditorText(
      user,
      screen.getByRole('textbox', { name: 'Modified SQL' }),
      'SELECT a FROM t',
    );
    expect(
      await screen.findByText('The scripts are equivalent after formatting.'),
    ).toBeInTheDocument();
    await setEditorText(
      user,
      screen.getByRole('textbox', { name: 'Modified SQL' }),
      'SELECT a, b FROM t',
    );
    await waitFor(() => {
      expect(screen.getByTestId('diff-modified')).toHaveTextContent('SELECT a, b FROM t');
    });
    expect(screen.queryByText(/equivalent/)).not.toBeInTheDocument();
  });

  it('saves queries and opens them from a link', async () => {
    const { user, router } = renderApp('/sql/formatter');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'SQL input' }),
      'select 1',
    );
    await user.click(screen.getByRole('button', { name: 'Save query' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save as query' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Health check');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved "Health check"')).toBeInTheDocument();
    const [saved] = await db.savedQueries.toArray();
    expect(saved).toMatchObject({
      name: 'Health check',
      kind: 'query',
      dialect: 'postgresql',
      content: 'select 1',
    });

    const other = await savedQueriesRepository.save({
      name: 'Other',
      dialect: 'mysql',
      kind: 'query',
      content: 'select 2',
    });
    await act(() => router.navigate(`/sql/validator?query=${other.id}`));
    await waitFor(async () => {
      expect(await value('SQL input')).toBe('select 2');
    });
    expect(useSqlWorkspaceStore.getState().dialect).toBe('mysql');
    expect(router.state.location.search).toBe('');

    await user.click(screen.getByRole('button', { name: 'Open saved query' }));
    const open = await screen.findByRole('dialog', { name: 'Open saved query' });
    await user.click(await within(open).findByText('Health check'));
    await waitFor(async () => {
      expect(await value('SQL input')).toBe('select 1');
    });
  });
});

describe('SQL to code', () => {
  it('generates C# entities from the sample schema and downloads one file per class', async () => {
    const { user } = renderApp('/sql/to-csharp');
    await user.click(await screen.findByRole('button', { name: 'Load sample' }));
    await waitFor(async () => {
      expect(
        (await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Generated code' })).value,
      ).toContain('public class Order');
    });
    const code = await value('Generated code');
    expect(code).toContain('[Table("orders")]');
    expect(code).toContain('public decimal Total { get; set; }');
    expect(code).toContain('public Guid? ExternalId { get; set; }');
    expect(screen.getByText('2 types')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download as ZIP' }));
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled();
    });
    const [blob, file] = vi.mocked(saveAs).mock.calls[0] as [Blob, string];
    expect(file).toBe('entities.zip');
    expect(Object.keys((await JSZip.loadAsync(await blob.arrayBuffer())).files).sort()).toEqual([
      'Customer.cs',
      'Order.cs',
    ]);
  });

  it('generates TypeScript types and follows the dialect (SQL Server sample)', async () => {
    const { user } = renderApp('/sql/to-typescript');
    await screen.findByRole('textbox', { name: 'CREATE TABLE statements' });
    await chooseDialect(user, 'SQL Server (T-SQL)');
    await user.click(screen.getByRole('button', { name: 'Load sample' }));
    await waitFor(async () => {
      expect(await value('Generated code')).toContain('export interface Order {');
    });
    const code = await value('Generated code');
    expect(code).toContain('  id: number;\n  customerId: number;');
    expect(code).toContain('  fullName: string | null;');
  });

  it('reports invalid CREATE TABLE scripts', async () => {
    const { user } = renderApp('/sql/to-csharp');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'CREATE TABLE statements' }),
      'SELECT 1',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('No CREATE TABLE statement found.');
  });
});

describe('statement generators', () => {
  it('builds SELECT, UPDATE, DELETE and INSERT statements for a table', async () => {
    const { user } = renderApp('/sql/query-generator');
    await user.click(await screen.findByRole('button', { name: 'Load sample' }));
    const table = await screen.findByRole('combobox', { name: 'Table' });
    await user.click(table);
    await user.click(screen.getByRole('option', { name: /^orders/ }));
    await waitFor(async () => {
      expect(await value('Generated SQL')).toContain('FROM orders;');
    });

    await user.click(screen.getByRole('checkbox', { name: /customers \(customer_id → id\)/ }));
    await waitFor(async () => {
      expect(await value('Generated SQL')).toContain(
        'INNER JOIN customers c ON c.id = o.customer_id',
      );
    });

    await user.click(screen.getByRole('tab', { name: 'UPDATE' }));
    await user.click(screen.getByRole('combobox', { name: 'SET columns' }));
    await user.click(screen.getByRole('option', { name: 'status' }));
    await waitFor(async () => {
      expect(await value('Generated SQL')).toBe('UPDATE orders\nSET status = $1\nWHERE id = $2;\n');
    });
    expect(screen.getByLabelText('Parameters')).toHaveTextContent('status, id');

    await user.click(screen.getByRole('tab', { name: 'DELETE' }));
    await user.click(screen.getByRole('button', { name: 'Remove condition 1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Add a WHERE condition/);
    await user.click(screen.getByRole('switch', { name: 'Allow deleting every row' }));
    await waitFor(async () => {
      expect(await value('Generated SQL')).toContain('DELETE FROM orders;');
    });

    await user.click(screen.getByRole('tab', { name: 'INSERT' }));
    await user.click(screen.getByRole('combobox', { name: 'Table' }));
    await user.click(screen.getByRole('option', { name: /^customers/ }));
    await user.click(screen.getByRole('combobox', { name: 'Row values' }));
    await user.click(screen.getByRole('option', { name: 'From JSON data' }));
    await user.click(screen.getByRole('button', { name: 'Load sample rows' }));
    await waitFor(async () => {
      expect(await value('Generated SQL')).toContain(
        "('ahmed@example.com', 'Ahmed O''Neil', 'DE', NULL)",
      );
    });
  });

  it('opens the dedicated generators fixed to their statement', async () => {
    const { user } = renderApp('/sql/delete-generator');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'DELETE Generator' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load sample' }));
    await waitFor(async () => {
      expect(await value('Generated SQL')).toContain('-- Rows that will be deleted:');
    });
    expect(screen.queryByRole('tab', { name: 'SELECT' })).not.toBeInTheDocument();
  });
});
