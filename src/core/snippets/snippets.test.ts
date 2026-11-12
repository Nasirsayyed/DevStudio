import { describe, expect, it } from 'vitest';
import type { CodeSnippetEntity } from '@/types/entities';
import { ParseError, ValidationError } from '../errors/AppError';
import {
  exportSnippets,
  exportVscodeSnippets,
  MAX_IMPORT_SNIPPETS,
  parseSnippetFile,
  planImport,
  snippetFileName,
  stripJsonComments,
} from './exchange';
import { emptySnippet, normalizeTags, prepareSnippet } from './model';
import { filterSnippets, snippetFacets } from './search';

const make = (over: Partial<CodeSnippetEntity>): CodeSnippetEntity => ({
  id: 'id',
  createdAt: 1,
  updatedAt: 1,
  title: 'Untitled',
  description: '',
  code: 'x',
  language: 'typescript',
  category: 'General',
  tags: [],
  isFavorite: 0,
  ...over,
});

const LIBRARY = [
  make({
    id: 'a',
    title: 'Debounce hook',
    code: 'export function useDebounce() {}',
    tags: ['react', 'hooks'],
    category: 'Frontend',
    updatedAt: 30,
    createdAt: 3,
  }),
  make({
    id: 'b',
    title: 'Fetch with retry',
    code: 'async function retry() { await fetch(url) }',
    tags: ['http'],
    category: 'Frontend',
    language: 'javascript',
    updatedAt: 20,
    createdAt: 2,
    isFavorite: 1,
  }),
  make({
    id: 'c',
    title: 'Find duplicates',
    code: 'SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1',
    tags: ['SQL', 'Reports'],
    category: 'Database',
    language: 'sql',
    description: 'Rows sharing an e-mail address',
    updatedAt: 10,
    createdAt: 1,
  }),
];

describe('snippet model', () => {
  it('normalizes tags (trim, #, commas, case-insensitive duplicates)', () => {
    expect(normalizeTags(['  React ', '#react', 'a,b', '', 'Hooks', 'hooks'])).toEqual([
      'React',
      'a b',
      'Hooks',
    ]);
  });

  it('validates and normalizes drafts', () => {
    expect(
      prepareSnippet({
        title: '  T ',
        description: ' d ',
        code: 'x',
        language: 'TS',
        category: '  ',
        tags: ['#a'],
      }),
    ).toEqual({
      title: 'T',
      description: 'd',
      code: 'x',
      language: 'typescript',
      category: 'General',
      tags: ['a'],
    });
    expect(() => prepareSnippet({ ...emptySnippet(), code: 'x' })).toThrow(
      'Give the snippet a title.',
    );
    expect(() => prepareSnippet({ ...emptySnippet(), title: 't', code: '  \n' })).toThrow(
      'The snippet has no code.',
    );
    expect(() => prepareSnippet({ ...emptySnippet(), title: 'x'.repeat(201), code: 'x' })).toThrow(
      ValidationError,
    );
    expect(() =>
      prepareSnippet({
        ...emptySnippet(),
        title: 't',
        code: 'x',
        tags: Array.from({ length: 21 }, (_, i) => `t${String(i)}`),
      }),
    ).toThrow('at most 20 tags');
    expect(() =>
      prepareSnippet({ ...emptySnippet(), title: 't', code: 'x', tags: ['x'.repeat(41)] }),
    ).toThrow('at most 40');
  });
});

describe('snippet search', () => {
  it('ranks title hits above tag, description and code hits; all words must match', () => {
    expect(filterSnippets(LIBRARY, { query: 'fetch' }).map((s) => s.id)).toEqual(['b']);
    expect(filterSnippets(LIBRARY, { query: 'e-mail' }).map((s) => s.id)).toEqual(['c']);
    expect(filterSnippets(LIBRARY, { query: '#sql' }).map((s) => s.id)).toEqual(['c']);
    expect(filterSnippets(LIBRARY, { query: 'function' }).map((s) => s.id)).toEqual(['a', 'b']);
    expect(filterSnippets(LIBRARY, { query: 'debounce react' }).map((s) => s.id)).toEqual(['a']);
    expect(filterSnippets(LIBRARY, { query: 'debounce nope' })).toEqual([]);
    expect(filterSnippets(LIBRARY, { query: 'FRONTEND' })).toHaveLength(2);
  });

  it('filters by favorites, category, language and tag (case-insensitive) and sorts', () => {
    expect(filterSnippets(LIBRARY, { favoritesOnly: true }).map((s) => s.id)).toEqual(['b']);
    expect(filterSnippets(LIBRARY, { category: 'Frontend' }).map((s) => s.id)).toEqual(['a', 'b']);
    expect(filterSnippets(LIBRARY, { language: 'sql' }).map((s) => s.id)).toEqual(['c']);
    expect(filterSnippets(LIBRARY, { tag: 'reports' }).map((s) => s.id)).toEqual(['c']);
    expect(filterSnippets(LIBRARY, { sort: 'title' }).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(filterSnippets(LIBRARY, { sort: 'created' }).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(filterSnippets(LIBRARY, {}).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(filterSnippets(LIBRARY, { sort: 'language' }).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('computes facets', () => {
    const f = snippetFacets([...LIBRARY, make({ id: 'd', tags: ['react'], category: 'Frontend' })]);
    expect(f).toMatchObject({ total: 4, favorites: 1 });
    expect(f.categories).toEqual([
      { name: 'Database', count: 1 },
      { name: 'Frontend', count: 3 },
    ]);
    expect(f.tags[0]).toEqual({ name: 'react', count: 2 });
    expect(f.languages[0]).toEqual({ name: 'typescript', count: 2 });
  });
});

describe('snippet import and export', () => {
  it('round-trips the DevStudio format', () => {
    const file = exportSnippets(LIBRARY, Date.UTC(2026, 0, 1));
    expect(JSON.parse(file)).toMatchObject({
      format: 'devstudio-snippets',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
    });
    const parsed = parseSnippetFile(file);
    expect(parsed.format).toBe('devstudio');
    expect(parsed.errors).toEqual([]);
    expect(parsed.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(parsed.items[1]).toMatchObject({
      isFavorite: true,
      language: 'javascript',
      updatedAt: 20,
      tags: ['http'],
    });
  });

  it('accepts a bare array and reports invalid items without importing them', () => {
    const parsed = parseSnippetFile(
      JSON.stringify([
        { title: 'Good', code: 'ok', language: 'Python' },
        { title: '', code: 'x' },
        { title: 'No code' },
        { title: 'Bad tags', code: 'x', tags: 'nope' },
        null,
      ]),
    );
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      title: 'Good',
      language: 'python',
      category: 'General',
      isFavorite: false,
    });
    expect(parsed.errors).toEqual([
      'Snippet 2: Give the snippet a title.',
      'Snippet 3 (“No code”): code: Invalid input: expected string, received undefined',
      'Snippet 4 (“Bad tags”): tags: Invalid input: expected array, received string',
      'Snippet 5: Invalid input: expected object, received null',
    ]);
  });

  it('imports VS Code snippet files, including comments, trailing commas and array bodies', () => {
    const vscode = `{
      // Created by me
      "Log value": { "prefix": "log", "body": ["console.log('$1', $1);", "$0"], "description": "Log it", "scope": "javascript,typescript" },
      "Print": { "prefix": ["pr", "print"], "body": "print($1)", },
    }`;
    const parsed = parseSnippetFile(vscode, 'python.json');
    expect(parsed.format).toBe('vscode');
    expect(parsed.items).toEqual([
      expect.objectContaining({
        title: 'Log value',
        code: "console.log('$1', $1);\n$0",
        language: 'javascript',
        tags: ['prefix:log'],
        description: 'Log it',
        category: 'VS Code',
      }),
      expect.objectContaining({
        title: 'Print',
        code: 'print($1)',
        language: 'python',
        tags: ['prefix:pr', 'prefix:print'],
      }),
    ]);
    expect(stripJsonComments('{"a": "// not a comment", /* x */ "b": [1,],}')).toBe(
      '{"a": "// not a comment",  "b": [1]}',
    );
  });

  it('rejects files that are not snippet files, too large, newer or polluted', () => {
    expect(() => parseSnippetFile('')).toThrow('The file is empty.');
    expect(() => parseSnippetFile('{oops')).toThrow(ParseError);
    expect(() => parseSnippetFile('{"name": "x"}')).toThrow(/Unrecognised file/);
    expect(() => parseSnippetFile('42')).toThrow(/Unrecognised file/);
    expect(() =>
      parseSnippetFile('{"format":"devstudio-snippets","version":2,"snippets":[]}'),
    ).toThrow(/newer DevStudio/);
    expect(() => parseSnippetFile('{"format":"devstudio-snippets","version":1}')).toThrow(
      /no "snippets"/,
    );
    const many = JSON.stringify(
      Array.from({ length: MAX_IMPORT_SNIPPETS + 1 }, () => ({ title: 't', code: 'c' })),
    );
    expect(() => parseSnippetFile(many)).toThrow(/at most 10,000/);
    const polluted = parseSnippetFile(
      '[{"title":"t","code":"c","__proto__":{"isAdmin":true},"constructor":{"x":1}}]',
    );
    expect(polluted.items).toHaveLength(1);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it('plans imports with skip, replace and copy strategies', () => {
    const existing = [
      { id: 'a', title: 'Debounce hook', code: 'export function useDebounce() {}' },
      { id: 'z', title: 'Other', code: 'x' },
    ];
    const items = [
      {
        id: 'a',
        title: 'Debounce hook v2',
        code: 'changed',
        description: '',
        language: 'typescript',
        category: 'General',
        tags: [],
        isFavorite: false,
      },
      {
        title: 'DEBOUNCE HOOK',
        code: 'export function useDebounce() {}',
        description: '',
        language: 'typescript',
        category: 'General',
        tags: [],
        isFavorite: false,
      },
      {
        id: 'new',
        title: 'Brand new',
        code: 'y',
        description: '',
        language: 'go',
        category: 'General',
        tags: [],
        isFavorite: false,
      },
      {
        id: 'new',
        title: 'Repeated id',
        code: 'w',
        description: '',
        language: 'go',
        category: 'General',
        tags: [],
        isFavorite: false,
      },
    ];
    const skip = planImport(existing, items, 'skip');
    expect(skip.skipped).toBe(2);
    expect(skip.add.map((i) => [i.id, i.title])).toEqual([
      ['new', 'Brand new'],
      [undefined, 'Repeated id'],
    ]);
    expect(planImport(existing, items, 'replace').update.map((u) => u.id)).toEqual(['a', 'a']);
    const copy = planImport(existing, items, 'copy');
    expect(copy.add.map((i) => i.title)).toEqual([
      'Debounce hook v2 (copy)',
      'DEBOUNCE HOOK (copy)',
      'Brand new',
      'Repeated id',
    ]);
    expect(copy.add[0]?.id).toBeUndefined();
  });

  it('exports VS Code snippets and builds file names', () => {
    const out = JSON.parse(
      exportVscodeSnippets([
        make({
          title: 'Log value',
          code: 'a\r\nb',
          tags: ['prefix:log'],
          description: 'd',
          language: 'shell',
        }),
        make({ title: 'Log value', code: 'c', language: 'plaintext' }),
      ]),
    ) as Record<string, unknown>;
    expect(out).toEqual({
      'Log value': { prefix: 'log', body: ['a', 'b'], description: 'd', scope: 'shellscript' },
      'Log value (2)': { prefix: 'log-value', body: ['c'] },
    });
    expect(snippetFileName({ title: 'Debounce hook / React', language: 'typescript' })).toBe(
      'Debounce-hook-React.ts',
    );
    expect(snippetFileName({ title: '!!!', language: 'unknown' })).toBe('snippet.txt');
    expect(snippetFileName({ title: 'x', language: 'dockerfile' })).toBe('Dockerfile');
  });
});
