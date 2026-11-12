import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/db/database';
import { TEXT_DRAFT_SETTING_KEY } from '@/stores/textWorkspaceStore';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';

const editor = (name: string) => screen.findByRole('textbox', { name });
const output = () => screen.findByRole('textbox', { name: 'Output' });
const frameDoc = (title: string) => screen.getByTitle(title).getAttribute('srcdoc') ?? '';

beforeEach(async () => {
  await resetAppState();
});

describe('Text Diff', () => {
  it('shows changed lines, counts and a unified diff', async () => {
    const { user } = renderApp('/text/text-diff');
    await setEditorText(user, await editor('Original'), 'alpha\nbeta\ngamma');
    await setEditorText(
      user,
      screen.getByRole('textbox', { name: 'Modified' }),
      'alpha\nBETA\ngamma\ndelta',
    );
    const table = await screen.findByRole('table', { name: 'Differences' });
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(4);
    });
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('~1')).toBeInTheDocument();
    expect(within(table).getByText('BETA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy unified diff' }));
    expect(await navigator.clipboard.readText()).toContain('-beta\n+BETA');
  });

  it('can ignore case and swap sides', async () => {
    const { user } = renderApp('/text/text-diff');
    await setEditorText(user, await editor('Original'), 'Hello');
    await setEditorText(user, screen.getByRole('textbox', { name: 'Modified' }), 'hello');
    await screen.findByRole('table', { name: 'Differences' });
    await user.click(screen.getByRole('switch', { name: 'Ignore case' }));
    expect(await screen.findByText('The texts are identical')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect(screen.getByRole('textbox', { name: 'Original' })).toHaveValue('hello');
    expect(screen.getByRole('textbox', { name: 'Modified' })).toHaveValue('Hello');
  });

  it('collapses long unchanged regions and expands them on request', async () => {
    const { user } = renderApp('/text/text-diff');
    const a = Array.from({ length: 30 }, (_, i) => `line ${String(i)}`).join('\n');
    await setEditorText(user, await editor('Original'), a);
    await setEditorText(
      user,
      screen.getByRole('textbox', { name: 'Modified' }),
      a.replace('line 15', 'LINE 15'),
    );
    const fold = await screen.findByRole('button', { name: /Show 12 unchanged lines/ });
    await user.click(fold);
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Show 12 unchanged lines/ }),
      ).not.toBeInTheDocument();
    });
  });
});

describe('Code Diff', () => {
  it('compares both editors in the diff view with the chosen language', async () => {
    const { user } = renderApp('/text/code-diff');
    await user.click(
      await screen
        .findAllByRole('button', { name: 'Load sample' })
        .then((b) => b[0] as HTMLElement),
    );
    await setEditorText(
      user,
      screen.getByRole('textbox', { name: 'Modified code' }),
      'const x = 2;',
    );
    const diff = await screen.findByRole('region', { name: 'Code differences' });
    await waitFor(() => {
      expect(within(diff).getByTestId('diff-modified')).toHaveTextContent('const x = 2;');
    });
    expect(within(diff).getByTestId('diff-original')).toHaveTextContent(
      'export function total(items)',
    );
  });
});

describe('Find and Replace', () => {
  it('finds plain text, lists matches and applies a replacement', async () => {
    const { user } = renderApp('/text/find-replace');
    await setEditorText(user, await editor('Text'), 'cat dog\ncat (cat)');
    await user.type(screen.getByRole('textbox', { name: 'Find' }), '(cat)');
    expect(await screen.findByText('1 match')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Find' }));
    await user.type(screen.getByRole('textbox', { name: 'Find' }), 'cat');
    expect(await screen.findByText('3 matches')).toBeInTheDocument();
    const grid = screen.getByRole('grid', { name: 'Matches' });
    expect(within(grid).getAllByRole('row').length).toBeGreaterThanOrEqual(3);

    await user.type(screen.getByRole('textbox', { name: 'Replace with' }), 'cow');
    await user.click(screen.getByRole('tab', { name: 'Replaced text' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Replaced text' })).toHaveValue(
        'cow dog\ncow (cow)',
      );
    });
    await user.click(screen.getByRole('button', { name: 'Apply to text' }));
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('cow dog\ncow (cow)');
  });

  it('supports regular expressions with groups and explains invalid ones', async () => {
    const { user } = renderApp('/text/find-replace');
    await setEditorText(user, await editor('Text'), 'Due 2024-01-31, paid 2024-02-15.');
    await user.click(screen.getByRole('switch', { name: 'Regular expression' }));
    const find = screen.getByRole('textbox', { name: 'Find (regular expression)' });
    await user.click(find);
    await user.paste('(\\d{4})-(\\d{2})-(\\d{2})');
    await user.click(screen.getByRole('textbox', { name: 'Replace with' }));
    await user.paste('$3/$2/$1');
    await user.click(screen.getByRole('tab', { name: 'Replaced text' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Replaced text' })).toHaveValue(
        'Due 31/01/2024, paid 15/02/2024.',
      );
    });
    await user.clear(find);
    await user.click(find);
    await user.paste('([a-z]');
    expect(await screen.findByText(/^Invalid regular expression/)).toBeInTheDocument();
  });
});

describe('Counter, line tools, reverse and case', () => {
  it('counts words, characters and reading time, and tracks a character limit', async () => {
    const { user } = renderApp('/text/counter');
    await setEditorText(
      user,
      await editor('Text'),
      'Hello world. Hello again!\n\nNew paragraph 👍🏽',
    );
    const words = await screen.findByRole('group', { name: 'Words' });
    await waitFor(() => {
      expect(within(words).getByText('6')).toBeInTheDocument();
    });
    expect(screen.getByRole('group', { name: 'Paragraphs' })).toHaveTextContent('2');
    expect(screen.getByRole('group', { name: 'Sentences' })).toHaveTextContent('3');
    expect(
      within(screen.getByRole('table', { name: 'Most frequent words' })).getByText('hello'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Character limit' }));
    await user.click(screen.getByRole('option', { name: 'X / Twitter post (280)' }));
    expect(await screen.findByText('238 characters left')).toBeInTheDocument();
  });

  it('removes duplicates, trims and sorts lines, and can feed the output back', async () => {
    const { user } = renderApp('/text/line-tools');
    await setEditorText(user, await editor('Lines'), ' file10\nfile2\n\nfile2 \nFile1');
    await waitFor(async () => {
      expect(await output()).toHaveValue('file10\nfile2\nFile1');
    });
    expect(screen.getByText('5 → 3 lines')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Sort' }));
    await user.click(screen.getByRole('option', { name: 'Natural (file2 < file10)' }));
    await waitFor(async () => {
      expect(await output()).toHaveValue('File1\nfile2\nfile10');
    });
    await user.click(screen.getByRole('button', { name: 'Use output as input' }));
    expect(screen.getByRole('textbox', { name: 'Lines' })).toHaveValue('File1\nfile2\nfile10');
  });

  it('shares the working text across tools: reverse and case conversion', async () => {
    const { user, router } = renderApp('/text/reverse');
    await setEditorText(user, await editor('Text'), 'first name\nHTTPStatus');
    await waitFor(async () => {
      expect(await output()).toHaveValue('sutatSPTTH\neman tsrif');
    });
    await act(() => router.navigate('/text/case-converter'));
    await waitFor(async () => {
      expect(await output()).toHaveValue('firstName\nhttpStatus');
    });
    await user.click(screen.getByRole('combobox', { name: 'Convert to' }));
    await user.click(screen.getByRole('option', { name: /^SCREAMING_SNAKE_CASE/ }));
    await waitFor(async () => {
      expect(await output()).toHaveValue('FIRST_NAME\nHTTP_STATUS');
    });
  });

  it('keeps the working text as a draft in IndexedDB', async () => {
    const { user } = renderApp('/text/counter');
    await setEditorText(user, await editor('Text'), 'remember me');
    await waitFor(
      async () => {
        expect((await db.settings.get(TEXT_DRAFT_SETTING_KEY))?.value).toMatchObject({
          text: 'remember me',
        });
      },
      { timeout: 3000 },
    );
  });
});

describe('Markdown and HTML preview', () => {
  it('renders sanitized Markdown in a sandboxed frame', async () => {
    const { user } = renderApp('/text/markdown-preview');
    await setEditorText(
      user,
      await editor('Markdown'),
      '# Title\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))',
    );
    await waitFor(() => {
      expect(frameDoc('Markdown preview')).toContain('<h1>Title</h1>');
    });
    const doc = frameDoc('Markdown preview');
    expect(doc).not.toMatch(/onerror|javascript:/);
    expect(doc).toContain("default-src 'none'");
    const frame = screen.getByTitle('Markdown preview');
    expect(frame.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox');
    expect(screen.getByText(/Removed for safety: onerror attribute/)).toBeInTheDocument();
    expect(screen.getByText(/1 external resource was blocked/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'HTML' }));
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Generated HTML' }).value,
    ).toContain('<h1>Title</h1>');
    await user.click(screen.getByRole('button', { name: 'Copy HTML' }));
    await waitFor(async () => {
      expect((await db.toolHistory.toArray())[0]).toMatchObject({
        toolId: 'text.markdown-preview',
      });
    });
  });

  it('previews HTML documents without scripts or remote resources', async () => {
    const { user } = renderApp('/text/html-preview');
    await user.click(await screen.findByRole('button', { name: 'Load sample' }));
    await waitFor(() => {
      expect(frameDoc('HTML preview')).toContain('Hello from HTML Preview');
    });
    const doc = frameDoc('HTML preview');
    expect(doc).not.toMatch(/<script|onclick|tracker\.example/);
    expect(doc).toContain('.card');
    const notice = screen.getByText(/Removed for safety/);
    expect(notice).toHaveTextContent('<script>');
    expect(notice).toHaveTextContent('onclick attribute');
    expect(notice).toHaveTextContent('1 external resource was blocked');
    await user.click(screen.getByRole('tab', { name: 'Sanitized HTML' }));
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Sanitized HTML' }).value,
    ).not.toContain('<script');
  });
});

describe('XML and YAML', () => {
  it('formats and minifies XML, reports errors, and shares the XML with XML → JSON', async () => {
    const { user, router } = renderApp('/text/xml-formatter');
    await setEditorText(user, await editor('XML input'), '<a><b x="1">t</b><c/></a>');
    await waitFor(async () => {
      expect(await output()).toHaveValue('<a>\n  <b x="1">t</b>\n  <c/>\n</a>\n');
    });
    await user.click(screen.getByRole('combobox', { name: 'Mode' }));
    await user.click(screen.getByRole('option', { name: 'Minify' }));
    await waitFor(async () => {
      expect(await output()).toHaveValue('<a><b x="1">t</b><c/></a>');
    });
    await setEditorText(user, screen.getByRole('textbox', { name: 'XML input' }), '<a>\n<b></a>');
    expect(await screen.findByRole('list', { name: 'XML input problems' })).toHaveTextContent(
      /error 2:/,
    );

    await act(() => router.navigate('/codegen/xml-to-json'));
    expect(await editor('XML input')).toHaveValue('<a>\n<b></a>');
  });

  it('formats YAML, converts it to JSON and converts the JSON document to YAML', async () => {
    const { user } = renderApp('/text/yaml-formatter');
    await setEditorText(user, await editor('YAML input'), 'name:   api\nlist: [1, 2]\n');
    await waitFor(async () => {
      expect(await output()).toHaveValue('name: api\nlist: [ 1, 2 ]\n');
    });
    await user.click(screen.getByRole('combobox', { name: 'Mode' }));
    await user.click(screen.getByRole('option', { name: 'YAML → JSON' }));
    await waitFor(async () => {
      expect(await output()).toHaveValue('{\n  "name": "api",\n  "list": [\n    1,\n    2\n  ]\n}');
    });
    await user.click(screen.getByRole('button', { name: 'Use as JSON document' }));

    await user.click(screen.getByRole('combobox', { name: 'Mode' }));
    await user.click(screen.getByRole('option', { name: 'JSON → YAML' }));
    expect(await editor('JSON input')).toHaveValue(
      '{\n  "name": "api",\n  "list": [\n    1,\n    2\n  ]\n}',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue('name: api\nlist:\n  - 1\n  - 2\n');
    });
  });

  it('points at YAML syntax errors', async () => {
    const { user } = renderApp('/text/yaml-formatter');
    await setEditorText(user, await editor('YAML input'), 'a: 1\nb: [1, 2\n');
    expect(await screen.findByRole('list', { name: 'YAML input problems' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Fix the input/);
  });
});
