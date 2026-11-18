import { describe, expect, it } from 'vitest';
import { ParseError } from '../errors/AppError';
import { safeJsonParse, tryParseJson } from './safeJsonParse';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":[1,2,{"b":null}]}')).toEqual({ a: [1, 2, { b: null }] });
    expect(safeJsonParse('"text"')).toBe('text');
  });

  it('strips prototype pollution keys at any depth', () => {
    const parsed = safeJsonParse(
      '{"__proto__":{"polluted":true},"nested":{"constructor":{"prototype":{"x":1}},"ok":1}}',
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(false);
    expect(parsed.nested).toEqual({ ok: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('throws ParseError on malformed input', () => {
    expect(() => safeJsonParse('{"a":')).toThrow(ParseError);
    expect(() => safeJsonParse('')).toThrow(ParseError);
    expect(() => safeJsonParse("{'single':1}")).toThrow(ParseError);
  });
});

describe('tryParseJson', () => {
  it('returns a result object instead of throwing', () => {
    expect(tryParseJson('[1]')).toEqual({ ok: true, value: [1] });
    const bad = tryParseJson('nope');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBeInstanceOf(ParseError);
  });
});
