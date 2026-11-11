import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { diffJson } from './diff';
import { queryJsonPath } from './jsonpath';
import {
  getAtPath,
  parseJsonPointer,
  resolvePointerSegments,
  toJsAccessor,
  toJsonPath,
  toJsonPointer,
} from './path';
import { searchJson } from './search';
import { ancestorIds, buildTreeRows, collectContainerIds } from './tree';
import type { JsonValue } from './types';

const store: JsonValue = {
  store: {
    book: [
      { title: 'Sayings', price: 8.95, tags: ['classic'] },
      { title: 'Sword of Honour', price: 12.99, isbn: '0-553' },
    ],
    'first name': "O'Neil",
  },
};

describe('path helpers', () => {
  const path = ['store', 'book', 0, 'first name', "it's"] as const;
  it('renders JSONPath, JS accessors and JSON Pointers', () => {
    expect(toJsonPath(path)).toBe("$.store.book[0]['first name']['it\\'s']");
    expect(toJsAccessor(path)).toBe('data.store.book[0]["first name"]["it\'s"]');
    expect(toJsonPointer(['a/b', 'c~d', 0])).toBe('/a~1b/c~0d/0');
    expect(toJsonPath([])).toBe('$');
  });

  it('parses pointers and resolves array indexes', () => {
    expect(parseJsonPointer('/a~1b/c~0d/0')).toEqual(['a/b', 'c~d', '0']);
    expect(parseJsonPointer('#/store/book/1')).toEqual(['store', 'book', '1']);
    expect(parseJsonPointer('')).toEqual([]);
    expect(() => parseJsonPointer('nope')).toThrow();
    expect(resolvePointerSegments(store, ['store', 'book', '1', 'title'])).toEqual([
      'store',
      'book',
      1,
      'title',
    ]);
  });

  it('reads values at paths', () => {
    expect(getAtPath(store, ['store', 'book', 1, 'price'])).toBe(12.99);
    expect(getAtPath(store, ['store', 'missing'])).toBeUndefined();
    expect(getAtPath(store, ['store', 'book', 'x'])).toBeUndefined();
    expect(getAtPath(store, ['store', 'book', 0, 'title', 'deeper'])).toBeUndefined();
  });
});

describe('diffJson', () => {
  const left: JsonValue = {
    id: 1,
    name: 'A',
    price: 10,
    tags: ['x', 'y'],
    address: { city: 'Dubai', zip: '1' },
    meta: null,
  };
  const right: JsonValue = {
    id: 1,
    name: 'B',
    price: '10',
    tags: ['x'],
    address: { city: 'Dubai' },
    extra: true,
    meta: null,
  };

  it('detects changed values, type differences and missing/extra properties', () => {
    const r = diffJson(left, right);
    expect(r.equal).toBe(false);
    expect(r.entries.map((e) => [e.kind, toJsonPath(e.path)])).toEqual([
      ['changed', '$.name'],
      ['type-changed', '$.price'],
      ['removed', '$.tags[1]'],
      ['removed', '$.address.zip'],
      ['added', '$.extra'],
    ]);
    expect(r.entries[1]).toMatchObject({ leftType: 'number', rightType: 'string' });
    expect(r.summary).toEqual({ added: 1, removed: 2, changed: 1, 'type-changed': 1 });
  });

  it('reports equality, including for key order differences', () => {
    expect(diffJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }).equal).toBe(true);
  });

  it('distinguishes arrays, objects and null', () => {
    expect(diffJson({ a: [] }, { a: {} }).entries[0]?.kind).toBe('type-changed');
    expect(diffJson({ a: null }, { a: 0 }).entries[0]?.kind).toBe('type-changed');
    expect(diffJson(1, 2).entries[0]).toMatchObject({ kind: 'changed', path: [] });
  });

  it('supports unordered array comparison', () => {
    expect(
      diffJson([1, { a: 1, b: 2 }, 3], [3, 1, { b: 2, a: 1 }], { arrayMode: 'unordered' }).equal,
    ).toBe(true);
    const r = diffJson([1, 2, 2], [2, 3], { arrayMode: 'unordered' });
    expect(r.entries.map((e) => [e.kind, e.path])).toEqual([
      ['removed', [0]],
      ['removed', [2]],
      ['added', [1]],
    ]);
  });

  it('truncates very large diffs', () => {
    const a = Array.from({ length: 50 }, (_, i) => i);
    const b = a.map((x) => x + 1);
    const r = diffJson(a, b, { maxEntries: 10 });
    expect(r.entries).toHaveLength(10);
    expect(r.truncated).toBe(true);
  });
});

describe('searchJson', () => {
  it('finds keys and values case-insensitively', () => {
    const r = searchJson(store, { query: 'sword' });
    expect(r.matches.map((m) => [toJsonPath(m.path), m.matchedOn])).toEqual([
      ['$.store.book[1].title', 'value'],
    ]);
    expect(searchJson(store, { query: 'PRICE', scope: 'keys' }).matches).toHaveLength(2);
  });

  it('matches numbers, exact mode and regex', () => {
    expect(searchJson(store, { query: '8.95' }).matches[0]?.type).toBe('number');
    expect(
      searchJson(store, { query: 'Sayings', mode: 'exact', caseSensitive: true }).matches,
    ).toHaveLength(1);
    expect(searchJson(store, { query: 'say', mode: 'exact' }).matches).toHaveLength(0);
    expect(searchJson(store, { query: '^\\d-\\d+$', mode: 'regex' }).matches[0]?.path).toEqual([
      'store',
      'book',
      1,
      'isbn',
    ]);
  });

  it('rejects invalid regex, honors limits and returns document order', () => {
    expect(() => searchJson(store, { query: '(', mode: 'regex' })).toThrow(ValidationError);
    const r = searchJson(store, { query: 'e', limit: 2 });
    expect(r.matches).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(searchJson(store, { query: '' }).matches).toEqual([]);
  });
});

describe('queryJsonPath', () => {
  it('evaluates expressions and returns typed paths', () => {
    const r = queryJsonPath(store, '$.store.book[*].title');
    expect(r.matches.map((m) => m.value)).toEqual(['Sayings', 'Sword of Honour']);
    expect(r.matches[1]?.path).toEqual(['store', 'book', 1, 'title']);
    expect(r.matches[1]?.jsonPath).toBe('$.store.book[1].title');
  });

  it('supports filters through the safe evaluator', () => {
    const r = queryJsonPath(store, '$..book[?(@.price < 10)].title');
    expect(r.matches.map((m) => m.value)).toEqual(['Sayings']);
  });

  it('supports recursive descent and bracket keys', () => {
    expect(queryJsonPath(store, '$..price').matches).toHaveLength(2);
    expect(queryJsonPath(store, "$.store['first name']").matches[0]?.value).toBe("O'Neil");
    expect(queryJsonPath(store, '$.nothing').matches).toEqual([]);
  });

  it('blocks code execution in filters', () => {
    const attempt = () =>
      queryJsonPath(store, '$..book[?(@.constructor.constructor("return globalThis")())]');
    // Either rejected or evaluated to no matches — never executed.
    try {
      expect(attempt().matches).toEqual([]);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  it('validates expressions', () => {
    expect(() => queryJsonPath(store, '')).toThrow(ValidationError);
    expect(() => queryJsonPath(store, 'store.book')).toThrow(/must start with "\$"/);
  });
});

describe('tree model', () => {
  it('builds visible rows and expands selectively', () => {
    const collapsed = buildTreeRows(store, new Set());
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({
      id: '',
      type: 'object',
      preview: '{1}',
      expandable: true,
      expanded: false,
    });

    const rows = buildTreeRows(store, new Set(['', '/store', '/store/book']));
    expect(rows.map((r) => [r.depth, r.name, r.preview])).toEqual([
      [0, null, '{1}'],
      [1, 'store', '{2}'],
      [2, 'book', '[2]'],
      [3, 0, '{3}'],
      [3, 1, '{3}'],
      [2, 'first name', '"O\'Neil"'],
    ]);
  });

  it('collects container ids by depth and computes ancestors', () => {
    expect(collectContainerIds(store, 1)).toEqual(new Set(['', '/store']));
    expect(collectContainerIds(store).size).toBe(6);
    expect(ancestorIds(['store', 'book', 1])).toEqual(['', '/store', '/store/book']);
  });

  it('caps rows for huge documents', () => {
    const big = Array.from({ length: 1000 }, (_, i) => i);
    expect(buildTreeRows(big, new Set(['']), 100)).toHaveLength(100);
  });
});
