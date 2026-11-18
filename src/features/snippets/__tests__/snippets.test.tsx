import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { saveAs } from 'file-saver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { snippetsRepository } from '@/services/db/repositories/snippetsRepository';
import { db } from '@/services/db/database';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

const list = () => screen.findByRole('listbox', { name: 'Snippets' });
const option = async (name: string) => within(await list()).findByRole('option', { name });

async function seed() {
  const a = await snippetsRepository.save({
    title: 'Debounce hook',
    description: 'React hook',
    code: 'export function useDebounce() {}',
    language: 'typescript',
    category: 'Frontend',
    tags: ['react'],
  });
  const b = await snippetsRepository.save({
    title: 'Find duplicate emails',
    description: '',
    code: 'SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1',
    language: 'sql',
    category: 'Database',
    tags: ['reports'],
  });
  return { a, b };
}

beforeEach(async () => {
  await resetAppState();
  vi.mocked(saveAs).mockClear();
});

describe('Snippet Manager', () => {
  it('creates a snippet with language, category and tags', async () => {
    const { user, router } = renderApp('/snippets');
    expect(await screen.findByText('Your snippet library is empty')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'New snippet' })[0] as HTMLElement);
    const form = await screen.findByRole('form', { name: 'New snippet' });
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), 'Retry fetch');
    await user.click(within(form).getByRole('combobox', { name: 'Language' }));
    await user.click(screen.getByRole('option', { name: 'JavaScript' }));
    const category = within(form).getByRole('combobox', { name: 'Category' });
    await user.clear(category);
    await user.type(category, 'Networking');
    const tags = within(form).getByRole('combobox', { name: 'Tags' });
    await user.type(tags, 'http{Enter}#HTTP{Enter}retry{Enter}');
    await setEditorText(
      user,
      within(form).getByRole('textbox', { name: 'Code' }),
      'await retry(fetch, 3);',
    );
    await user.click(within(form).getByRole('button', { name: 'Save snippet' }));

    expect(await screen.findByText('Saved “Retry fetch”.')).toBeInTheDocument();
    const [saved] = await db.codeSnippets.toArray();
    expect(saved).toMatchObject({
      title: 'Retry fetch',
      language: 'javascript',
      category: 'Networking',
      tags: ['http', 'retry'],
      code: 'await retry(fetch, 3);',
      isFavorite: 0,
    });
    expect(router.state.location.search).toBe(`?snippet=${saved?.id ?? ''}`);
    await waitFor(async () => {
      expect(await option('Retry fetch')).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByRole('form', { name: 'Edit Retry fetch' })).toBeInTheDocument();
  });

  it('explains what is missing and saves nothing', async () => {
    const { user } = renderApp('/snippets?new=1');
    const form = await screen.findByRole('form', { name: 'New snippet' });
    await user.click(within(form).getByRole('button', { name: 'Save snippet' }));
    expect(await within(form).findByText('Give the snippet a title.')).toBeInTheDocument();
    expect(within(form).getByText('The snippet has no code.')).toBeInTheDocument();
    expect(await db.codeSnippets.count()).toBe(0);
  });

  it('opens deep links, saves with Ctrl+S and toggles favorites', async () => {
    const { a } = await seed();
    const { user } = renderApp(`/snippets?snippet=${a.id}`);
    const form = await screen.findByRole('form', { name: 'Edit Debounce hook' });
    const save = within(form).getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    const title = within(form).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'useDebounce hook');
    expect(save).toBeEnabled();
    fireEvent.keyDown(title, { key: 's', ctrlKey: true });
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect((await db.codeSnippets.get(a.id))?.title).toBe('useDebounce hook');
    await waitFor(() => {
      expect(
        within(screen.getByRole('form', { name: /^Edit/ })).getByRole('button', {
          name: 'Save changes',
        }),
      ).toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }));
    await waitFor(async () => {
      expect((await db.codeSnippets.get(a.id))?.isFavorite).toBe(1);
    });
    await user.click(
      within(screen.getByRole('navigation', { name: 'Snippet filters' })).getByRole('button', {
        name: /Favorites/,
      }),
    );
    expect(within(await list()).getAllByRole('option')).toHaveLength(1);
  });

  it('asks before discarding unsaved changes', async () => {
    const { a, b } = await seed();
    const { user, router } = renderApp(`/snippets?snippet=${a.id}`);
    const form = await screen.findByRole('form', { name: 'Edit Debounce hook' });
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), ' (edited)');

    await user.click(await option('Find duplicate emails'));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(router.state.location.search).toBe(`?snippet=${a.id}`);
    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Debounce hook (edited)',
    );

    // Leaving the page is guarded too.
    await act(() => router.navigate('/settings'));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );
    expect(router.state.location.pathname).toBe('/snippets');

    await user.click(await option('Find duplicate emails'));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).getByRole(
        'button',
        { name: 'Discard' },
      ),
    );
    expect(
      await screen.findByRole('form', { name: 'Edit Find duplicate emails' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?snippet=${b.id}`);
    expect((await db.codeSnippets.get(a.id))?.title).toBe('Debounce hook');
  });

  it('searches titles, tags and code, and filters by category, language and tag', async () => {
    await seed();
    const { user } = renderApp('/snippets');
    await list();
    await waitFor(async () => {
      expect(within(await list()).getAllByRole('option')).toHaveLength(2);
    });
    await user.type(screen.getByRole('searchbox', { name: 'Search snippets' }), 'having');
    await waitFor(async () => {
      expect(
        within(await list())
          .getAllByRole('option')
          .map((o) => o.getAttribute('aria-label')),
      ).toEqual(['Find duplicate emails']);
    });
    await user.clear(screen.getByRole('searchbox', { name: 'Search snippets' }));
    const nav = screen.getByRole('navigation', { name: 'Snippet filters' });
    await user.click(within(nav).getByRole('button', { name: /^Frontend/ }));
    await waitFor(async () => {
      expect(
        within(await list())
          .getAllByRole('option')
          .map((o) => o.getAttribute('aria-label')),
      ).toEqual(['Debounce hook']);
    });
    await user.click(within(nav).getByRole('button', { name: /^SQL/ }));
    expect(
      within(await list())
        .getAllByRole('option')
        .map((o) => o.getAttribute('aria-label')),
    ).toEqual(['Find duplicate emails']);
    await user.click(within(nav).getByRole('button', { name: 'reports 1' }));
    expect(within(await list()).getAllByRole('option')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(await list()).getAllByRole('option')).toHaveLength(2);
  });

  it('duplicates, deletes with undo, and renames categories', async () => {
    const { a } = await seed();
    const { user } = renderApp(`/snippets?snippet=${a.id}`);
    await screen.findByRole('form', { name: 'Edit Debounce hook' });
    await user.click(screen.getByRole('button', { name: 'Duplicate snippet' }));
    expect(
      await screen.findByRole('form', { name: 'Edit Debounce hook (copy)' }),
    ).toBeInTheDocument();
    expect(await db.codeSnippets.count()).toBe(3);

    await user.click(screen.getByRole('button', { name: 'Delete snippet' }));
    expect(await screen.findByText('Deleted “Debounce hook (copy)”.')).toBeInTheDocument();
    expect(await db.codeSnippets.count()).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => {
      expect(await db.codeSnippets.count()).toBe(3);
    });

    const nav = screen.getByRole('navigation', { name: 'Snippet filters' });
    await user.click(within(nav).getByRole('button', { name: 'Category actions for Frontend' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename category…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename category' });
    const field = within(dialog).getByRole('textbox', { name: 'Category name' });
    await user.clear(field);
    await user.type(field, 'React');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(
      await screen.findByText('Renamed “Frontend” to “React” (2 snippets).'),
    ).toBeInTheDocument();
    expect(await db.codeSnippets.where('category').equals('React').count()).toBe(2);
  });

  it('exports JSON and imports it back, skipping or copying duplicates', async () => {
    await seed();
    const { user } = renderApp('/snippets');
    await list();
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('menuitem', { name: /All snippets \(2\) as JSON/ }));
    const [blob, name] = vi.mocked(saveAs).mock.calls[0] as [Blob, string];
    expect(name).toMatch(/^devstudio-snippets-\d{4}-\d{2}-\d{2}\.json$/);
    const text = await blob.text();
    expect(JSON.parse(text)).toMatchObject({ format: 'devstudio-snippets', snippets: [{}, {}] });

    await user.click(screen.getByRole('button', { name: 'Import' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import snippets' });
    const file = new File(
      [text.replace('"snippets": [', '"snippets": [{"title":"","code":"x"},')],
      'backup.json',
      {
        type: 'application/json',
      },
    );
    await user.upload(within(dialog).getByLabelText('Choose file'), file);
    expect(
      await within(dialog).findByText(/2 snippets ready to import, 1 invalid/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('list', { name: 'Import problems' })).toHaveTextContent(
      'Snippet 1: Give the snippet a title.',
    );
    expect(
      within(dialog).getByText('2 snippets already exist in your library'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Import them as copies' }));
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Import finished: 2 added.')).toBeInTheDocument();
    expect((await db.codeSnippets.toArray()).map((s) => s.title).sort()).toEqual([
      'Debounce hook',
      'Debounce hook (copy)',
      'Find duplicate emails',
      'Find duplicate emails (copy)',
    ]);
  });

  it('imports VS Code snippet files and rejects unrelated files', async () => {
    const { user } = renderApp('/snippets');
    await screen.findByText('Your snippet library is empty');
    await user.click(screen.getAllByRole('button', { name: 'Import' })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Import snippets' });
    const input = within(dialog).getByLabelText('Choose file');
    await user.upload(
      input,
      new File(['{"name":"pkg","version":"1.0.0"}'], 'package.json', { type: 'application/json' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Unrecognised file/);
    await user.upload(
      input,
      new File(
        ['{ // mine\n "Print": { "prefix": "pr", "body": ["print($1)"] }, }'],
        'python.json',
        { type: 'application/json' },
      ),
    );
    expect(await within(dialog).findByText(/1 snippet ready to import/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Import finished: 1 added.')).toBeInTheDocument();
    expect((await db.codeSnippets.toArray())[0]).toMatchObject({
      title: 'Print',
      language: 'python',
      tags: ['prefix:pr'],
      code: 'print($1)',
    });
  });

  it('is reachable from the command palette ("New snippet")', async () => {
    const { user, router } = renderApp('/');
    await user.keyboard('{Control>}k{/Control}');
    await user.type(
      await screen.findByRole('combobox', { name: 'Search command palette' }),
      '>new snippet',
    );
    await user.click(await screen.findByRole('option', { name: /New snippet/ }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?new=1');
    });
    expect(await screen.findByRole('form', { name: 'New snippet' })).toBeInTheDocument();
  });
});
