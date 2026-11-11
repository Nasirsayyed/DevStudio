import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { flattenJson, unflattenJson } from './flatten';
import { beautifyJson, formatJson, minifyJson, sortKeysDeep, utf8ByteLength } from './format';
import type { JsonValue } from './types';

const doc: JsonValue = { b: 1, a: { d: [3, 1, 2], c: 'x' }, list: [{ z: 1, y: 2 }] };

describe('format / minify', () => {
  it('formats with 2, 4 or tab indentation', () => {
    expect(formatJson({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}');
    expect(formatJson({ a: 1 }, 4)).toBe('{\n    "a": 1\n}');
    expect(formatJson({ a: 1 }, 'tab')).toBe('{\n\t"a": 1\n}');
  });

  it('minifies', () => {
    expect(minifyJson(doc)).toBe('{"b":1,"a":{"d":[3,1,2],"c":"x"},"list":[{"z":1,"y":2}]}');
  });

  it('preserves unicode and escapes', () => {
    const v = { s: 'é😀"\n' };
    expect(JSON.parse(formatJson(v))).toEqual(v);
  });

  it('measures UTF-8 byte length', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
  });
});

describe('sortKeysDeep', () => {
  it('sorts keys recursively and keeps array order', () => {
    expect(minifyJson(sortKeysDeep(doc))).toBe(
      '{"a":{"c":"x","d":[3,1,2]},"b":1,"list":[{"y":2,"z":1}]}',
    );
  });

  it('supports descending, natural and case-insensitive ordering', () => {
    const v = { item10: 1, item2: 1, B: 1, a: 1 };
    expect(Object.keys(sortKeysDeep(v) as object)).toEqual(['a', 'B', 'item2', 'item10']);
    expect(Object.keys(sortKeysDeep(v, { direction: 'desc' }) as object)).toEqual([
      'item10',
      'item2',
      'B',
      'a',
    ]);
    expect(Object.keys(sortKeysDeep(v, { natural: false }) as object)).toEqual([
      'a',
      'B',
      'item10',
      'item2',
    ]);
  });

  it('keeps "__proto__" as a regular key without changing prototypes', () => {
    const parsed = JSON.parse('{"z": 1, "__proto__": {"x": 1}}') as JsonValue;
    const sorted = sortKeysDeep(parsed) as Record<string, unknown>;
    expect(Object.keys(sorted)).toEqual(['__proto__', 'z']);
    expect(Object.getPrototypeOf(sorted)).toBe(Object.prototype);
    expect(minifyJson(sorted as JsonValue)).toBe('{"__proto__":{"x":1},"z":1}');
  });
});

describe('beautifyJson', () => {
  it('inlines short primitive arrays and objects', () => {
    const out = beautifyJson({
      tags: ['a', 'b'],
      point: { x: 1, y: 2 },
      nested: [{ a: 1 }, { b: [1, 2] }],
    });
    expect(out).toBe(
      '{\n  "tags": ["a", "b"],\n  "point": { "x": 1, "y": 2 },\n  "nested": [\n    { "a": 1 },\n    {\n      "b": [1, 2]\n    }\n  ]\n}',
    );
    expect(JSON.parse(out)).toEqual({
      tags: ['a', 'b'],
      point: { x: 1, y: 2 },
      nested: [{ a: 1 }, { b: [1, 2] }],
    });
  });

  it('breaks long arrays and can disable inlining', () => {
    const long = { values: Array.from({ length: 40 }, (_, i) => i) };
    expect(beautifyJson(long, { maxInlineWidth: 40 }).split('\n').length).toBeGreaterThan(40);
    expect(beautifyJson({ a: [1] }, { maxInlineWidth: 0 })).toBe(formatJson({ a: [1] }));
  });

  it('can sort keys and handles empty containers and primitives', () => {
    expect(beautifyJson({ b: {}, a: [] }, { sortKeys: true })).toBe(
      '{ "a": [], "b": {} }'.replace('{ "a": [], "b": {} }', '{\n  "a": [],\n  "b": {}\n}'),
    );
    expect(beautifyJson('text')).toBe('"text"');
    expect(beautifyJson(null)).toBe('null');
  });
});

describe('flatten / unflatten', () => {
  const nested: JsonValue = {
    user: { id: 1, roles: ['admin', 'dev'], meta: {} },
    tags: [],
    ok: true,
  };

  it('flattens with dot and bracket notation', () => {
    expect(flattenJson(nested).value).toEqual({
      'user.id': 1,
      'user.roles.0': 'admin',
      'user.roles.1': 'dev',
      'user.meta': {},
      tags: [],
      ok: true,
    });
    expect(Object.keys(flattenJson(nested, { arrayNotation: 'bracket' }).value)).toContain(
      'user.roles[1]',
    );
    expect(Object.keys(flattenJson(nested, { delimiter: '/' }).value)).toContain('user/roles/0');
  });

  it('round-trips through unflatten', () => {
    expect(unflattenJson(flattenJson(nested).value)).toEqual(nested);
    expect(unflattenJson(flattenJson(nested, { arrayNotation: 'bracket' }).value)).toEqual(nested);
    expect(
      unflattenJson(flattenJson(nested, { delimiter: '__' }).value, { delimiter: '__' }),
    ).toEqual(nested);
  });

  it('flattens root arrays', () => {
    expect(flattenJson([{ a: 1 }, 2]).value).toEqual({ '0.a': 1, '1': 2 });
    expect(unflattenJson({ '0.a': 1, '1': 2 })).toEqual([{ a: 1 }, 2]);
  });

  it('reports ambiguous keys containing the delimiter', () => {
    expect(flattenJson({ 'a.b': 1 }).ambiguousKeys).toEqual(['a.b']);
  });

  it('only creates arrays for dense 0..n-1 indexes', () => {
    expect(unflattenJson({ 'a.0': 'x', 'a.2': 'y' })).toEqual({ a: { 0: 'x', 2: 'y' } });
    expect(unflattenJson({ 'a.0': 'x' }, { detectArrays: false })).toEqual({ a: { 0: 'x' } });
  });

  it('rejects conflicting keys and invalid input', () => {
    expect(() => unflattenJson({ a: 1, 'a.b': 2 })).toThrow(ValidationError);
    expect(() => unflattenJson({ 'a.b': 2, a: 1 })).toThrow(/both a value and a parent/);
    expect(() => unflattenJson([1])).toThrow(ValidationError);
    expect(() => flattenJson(5)).toThrow(ValidationError);
    expect(() => flattenJson({}, { delimiter: '' })).toThrow(ValidationError);
  });

  it('is prototype-pollution safe', () => {
    const out = unflattenJson({
      '__proto__.polluted': true,
      'constructor.prototype.bad': 1,
    }) as Record<string, unknown>;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).bad).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(JSON.stringify(out)).toBe(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"bad":1}}}',
    );
  });
});
