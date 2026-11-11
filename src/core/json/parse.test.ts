import { describe, expect, it } from 'vitest';
import { ParseError } from '../errors/AppError';
import { analyzeJson, parseJson, parseJsonOrThrow, positionAt } from './parse';

function errorOf(text: string) {
  const a = analyzeJson(text);
  expect(a.valid).toBe(false);
  return a.error!;
}

describe('analyzeJson — valid documents', () => {
  it.each([
    ['{}'],
    ['[]'],
    ['0'],
    ['-0.5e+10'],
    ['"a\\u00e9\\n\\"q\\""'],
    ['true'],
    ['null'],
    ['  {"a": [1, {"b": null}], "c": "x"}  '],
    ['{"emoji": "😀", "rtl": "مرحبا"}'],
  ])('accepts %s', (text) => {
    const a = analyzeJson(text);
    expect(a.error).toBeNull();
    expect(a.valid).toBe(true);
  });

  it('collects statistics', () => {
    const a = analyzeJson('{"a": [1, 2.5, {"b": true, "c": null}], "d": "s"}');
    expect(a.stats).toEqual({
      depth: 3,
      objects: 2,
      arrays: 1,
      keys: 4,
      strings: 1,
      numbers: 2,
      booleans: 1,
      nulls: 1,
    });
  });

  it('reports duplicate keys with their location and parent path', () => {
    const a = analyzeJson('{\n  "a": 1,\n  "list": [{"id": 1, "id": 2}],\n  "a": 3\n}');
    expect(a.valid).toBe(true);
    expect(a.duplicates.map((d) => [d.key, d.path, d.line, d.column])).toEqual([
      ['id', ['list', 0], 3, 22],
      ['a', [], 4, 3],
    ]);
    expect(a.duplicateCount).toBe(2);
  });

  it('caps reported duplicates but keeps counting', () => {
    const text = `{${Array.from({ length: 10 }, () => '"k": 1').join(',')}}`;
    const a = analyzeJson(text, 3);
    expect(a.duplicates).toHaveLength(3);
    expect(a.duplicateCount).toBe(9);
  });
});

describe('analyzeJson — malformed documents', () => {
  it.each([
    ['', 'The document is empty', 1, 1],
    ['   \n ', 'The document is empty', 1, 1],
    ['{"a": 1,}', "Trailing comma before '}' is not allowed in JSON", 1, 8],
    ['[1, 2,\n]', "Trailing comma before ']' is not allowed in JSON", 1, 6],
    ['{"a": 1 "b": 2}', "Expected ',' between properties (missing comma)", 1, 9],
    ['{a: 1}', 'Property names must be double-quoted strings', 1, 2],
    ["{'a': 1}", 'Property names must use double quotes (") in JSON', 1, 2],
    ['{"a" 1}', "Expected ':' after property name, found '1'", 1, 6],
    ['["a\nb"]', 'Line break inside a string (use \\n or close the quote)', 1, 4],
    ['"abc', 'Unterminated string', 1, 1],
    ['"\\x"', "Invalid escape sequence '\\x' in string", 1, 2],
    ['"\\u12G4"', 'Invalid unicode escape: expected \\u followed by 4 hex digits', 1, 2],
    ['012', 'Numbers cannot have leading zeros', 1, 1],
    ['1.', 'Invalid number: expected a digit after the decimal point', 1, 3],
    ['1e', 'Invalid number: expected a digit in the exponent', 1, 3],
    ['-', "Invalid number: expected a digit after '-'", 1, 2],
    ['.5', "Invalid number: numbers cannot start with '.'", 1, 1],
    ['tru', "Unexpected token 'tru'", 1, 1],
    ['True', "Unexpected token 'True' (did you mean 'true'?)", 1, 1],
    ['NULL', "Unexpected token 'NULL' (did you mean 'null'?)", 1, 1],
    ['undefined', "'undefined' is not a valid JSON value", 1, 1],
    ['NaN', "'NaN' is not a valid JSON value", 1, 1],
    [
      '{"a": 1} {"b": 2}',
      "Unexpected '{' after the end of the JSON value (only one root value is allowed)",
      1,
      10,
    ],
    ['// c\n{}', 'Comments are not allowed in JSON', 1, 1],
    ['{"a": /* x */ 1}', 'Comments are not allowed in JSON', 1, 7],
    ['[1, 2', "Unexpected end of input, expected ',' or ']'", 1, 6],
    ['{"a": 1', "Unexpected end of input, expected ',' or '}'", 1, 8],
    ['{"a":', 'Unexpected end of input, expected a value', 1, 6],
    ['[,1]', "Unexpected ',', expected a value", 1, 2],
    ['﻿{}', 'Unexpected byte order mark (BOM) at the start of the document', 1, 1],
  ])('%j → %s', (text, message, line, column) => {
    const e = errorOf(text);
    expect(e.message).toBe(message);
    expect([e.line, e.column]).toEqual([line, column]);
  });

  it('reports positions on later lines with CRLF and tabs', () => {
    const e = errorOf('{\r\n\t"a": 1,\r\n\t"b": tru\r\n}');
    expect([e.line, e.column]).toEqual([3, 7]);
  });

  it('agrees with JSON.parse on validity for a corpus of inputs', () => {
    const corpus = [
      '{"a":1}',
      '[1,2,]',
      '{"a":"\\t"}',
      '"\t"',
      '1 2',
      '[[[]]]',
      '{"":0}',
      '-01',
      '1E+2',
      '[-]',
      '"\\/"',
      '{"a":[}',
    ];
    for (const text of corpus) {
      let native = true;
      try {
        JSON.parse(text);
      } catch {
        native = false;
      }
      expect(analyzeJson(text).valid, text).toBe(native);
    }
  });

  it('handles extreme nesting without overflowing the stack', () => {
    const valid = analyzeJson('['.repeat(6000) + ']'.repeat(6000));
    expect(valid).toMatchObject({ valid: true, nestingLimitReached: true, error: null });
    const invalid = analyzeJson('['.repeat(6000) + ']'.repeat(5999));
    expect(invalid.valid).toBe(false);
    expect(invalid.nestingLimitReached).toBe(true);
    expect(invalid.error?.message).toBeTruthy();
  });

  it('suggests the right literal for wrongly-cased or unknown words', () => {
    expect(errorOf('[FALSE]').message).toBe("Unexpected token 'FALSE' (did you mean 'false'?)");
    expect(errorOf('{"a": yes}').message).toBe("Unexpected token 'yes'");
    expect(errorOf('Infinity').message).toBe("'Infinity' is not a valid JSON value");
  });
});

describe('parseJson', () => {
  it('returns values for valid input', () => {
    expect(parseJson('{"a":[1,"x"]}')).toEqual({ ok: true, value: { a: [1, 'x'] } });
  });

  it('throws ParseError with line and column for invalid input', () => {
    try {
      parseJsonOrThrow('{\n  "a": 1,\n  "b": }', 'Left document');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      const err = e as ParseError;
      expect(err.line).toBe(3);
      expect(err.column).toBe(8);
      expect(err.message).toBe(
        "Left document: Unexpected '}', expected a value (line 3, column 8)",
      );
    }
  });

  it('keeps "__proto__" keys as data without polluting prototypes', () => {
    const r = parseJson('{"__proto__": {"polluted": true}}');
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('positionAt', () => {
  it('computes 1-based line/column and clamps offsets', () => {
    expect(positionAt('ab\ncd', 4)).toEqual({ offset: 4, line: 2, column: 2 });
    expect(positionAt('ab', 99)).toEqual({ offset: 2, line: 1, column: 3 });
    expect(positionAt('ab', -5)).toEqual({ offset: 0, line: 1, column: 1 });
  });
});
