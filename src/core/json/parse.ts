import { ParseError } from '../errors/AppError';
import type { JsonValue, PathSegment } from './types';

/** 1-based line/column position of an offset in a text. */
export interface TextPosition {
  offset: number;
  line: number;
  column: number;
}

export interface JsonSyntaxIssue extends TextPosition {
  message: string;
}

export interface DuplicateKeyIssue extends TextPosition {
  key: string;
  /** Path of the object containing the duplicated key. */
  path: PathSegment[];
}

export interface JsonStats {
  depth: number;
  objects: number;
  arrays: number;
  keys: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
}

export interface JsonAnalysis {
  valid: boolean;
  /** True when nesting exceeded MAX_NESTING_DEPTH: validity comes from JSON.parse and stats are partial. */
  nestingLimitReached: boolean;
  error: JsonSyntaxIssue | null;
  duplicates: DuplicateKeyIssue[];
  /** Duplicate keys beyond the reporting limit are counted here. */
  duplicateCount: number;
  stats: JsonStats;
}

/**
 * The scanner is recursive; beyond this depth it stops and defers to the native
 * parser for validity, so it never overflows the call stack.
 */
export const MAX_NESTING_DEPTH = 1000;

export function positionAt(text: string, offset: number): TextPosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { offset: clamped, line, column: clamped - lineStart + 1 };
}

class NestingLimit extends Error {}

class SyntaxFailure extends Error {
  readonly offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

/** Character codes used by the scanner. */
const Ch = {
  Tab: 9,
  LineFeed: 10,
  CarriageReturn: 13,
  Space: 32,
  Quote: 34,
  Plus: 43,
  Comma: 44,
  Minus: 45,
  Dot: 46,
  Slash: 47,
  Zero: 48,
  Nine: 57,
  Colon: 58,
  OpenBracket: 91,
  Backslash: 92,
  CloseBracket: 93,
  OpenBrace: 123,
  CloseBrace: 125,
} as const;

function describeChar(text: string, offset: number): string {
  const ch = text[offset];
  if (ch === undefined) return 'end of input';
  if (ch === '\n') return 'line break';
  if (ch === '\t') return 'tab';
  return `'${ch}'`;
}

/**
 * Strict RFC 8259 scanner. It validates syntax, reports the first error with a
 * precise position and a human-friendly message, detects duplicate keys and
 * collects statistics. It does not build values (JSON.parse is used for that).
 */
class Scanner {
  private pos = 0;
  readonly stats: JsonStats = {
    depth: 0,
    objects: 0,
    arrays: 0,
    keys: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
  };
  readonly duplicates: { key: string; offset: number; path: PathSegment[] }[] = [];
  duplicateCount = 0;
  private readonly path: PathSegment[] = [];

  private readonly text: string;
  private readonly maxDuplicates: number;

  constructor(text: string, maxDuplicates: number) {
    this.text = text;
    this.maxDuplicates = maxDuplicates;
  }

  run(): void {
    if (this.text.charCodeAt(0) === 0xfeff) {
      throw new SyntaxFailure('Unexpected byte order mark (BOM) at the start of the document', 0);
    }
    this.skipWhitespace();
    if (this.pos >= this.text.length) throw new SyntaxFailure('The document is empty', 0);
    this.value(0);
    this.skipWhitespace();
    if (this.pos < this.text.length) {
      throw new SyntaxFailure(
        `Unexpected ${describeChar(this.text, this.pos)} after the end of the JSON value (only one root value is allowed)`,
        this.pos,
      );
    }
  }

  private fail(message: string, offset = this.pos): never {
    throw new SyntaxFailure(message, offset);
  }

  private skipWhitespace(): void {
    const t = this.text;
    for (;;) {
      const c = t.charCodeAt(this.pos);
      if (c === Ch.Space || c === Ch.LineFeed || c === Ch.CarriageReturn || c === Ch.Tab) {
        this.pos += 1;
      } else if (c === Ch.Slash && (t[this.pos + 1] === '/' || t[this.pos + 1] === '*')) {
        this.fail('Comments are not allowed in JSON');
      } else {
        return;
      }
    }
  }

  private value(depth: number): void {
    if (depth > MAX_NESTING_DEPTH) throw new NestingLimit();
    if (depth > this.stats.depth) this.stats.depth = depth;
    const c = this.text.charCodeAt(this.pos);
    switch (c) {
      case Ch.OpenBrace:
        this.object(depth);
        return;
      case Ch.OpenBracket:
        this.array(depth);
        return;
      case Ch.Quote:
        this.string();
        this.stats.strings += 1;
        return;
      case Ch.Minus:
        this.number();
        return;
      default:
        break;
    }
    if (c >= Ch.Zero && c <= Ch.Nine) {
      this.number();
      return;
    }
    const ch = this.text[this.pos];
    if (ch !== undefined && /[A-Za-z]/.test(ch)) {
      this.literal();
      return;
    }
    if (ch === undefined) this.fail('Unexpected end of input, expected a value');
    if (ch === "'") this.fail('Strings must use double quotes (") in JSON');
    if (ch === '}' || ch === ']') this.fail(`Unexpected '${ch}', expected a value`);
    if (ch === ',') this.fail("Unexpected ',', expected a value");
    if (ch === '.' || ch === '+') this.fail(`Invalid number: numbers cannot start with '${ch}'`);
    this.fail(`Unexpected ${describeChar(this.text, this.pos)}, expected a value`);
  }

  private object(depth: number): void {
    this.stats.objects += 1;
    this.pos += 1;
    this.skipWhitespace();
    if (this.text.charCodeAt(this.pos) === Ch.CloseBrace) {
      this.pos += 1;
      return;
    }
    const seen = new Set<string>();
    for (;;) {
      const c = this.text.charCodeAt(this.pos);
      if (c !== Ch.Quote) {
        const ch = this.text[this.pos];
        if (ch === undefined) this.fail("Unexpected end of input, expected a property name or '}'");
        if (ch === "'") this.fail('Property names must use double quotes (") in JSON');
        if (/[A-Za-z_$]/.test(ch)) this.fail('Property names must be double-quoted strings');
        this.fail(`Unexpected ${describeChar(this.text, this.pos)}, expected a property name`);
      }
      const keyOffset = this.pos;
      const key = this.string();
      this.stats.keys += 1;
      if (seen.has(key)) {
        this.duplicateCount += 1;
        if (this.duplicates.length < this.maxDuplicates) {
          this.duplicates.push({ key, offset: keyOffset, path: [...this.path] });
        }
      } else {
        seen.add(key);
      }
      this.skipWhitespace();
      if (this.text.charCodeAt(this.pos) !== Ch.Colon) {
        this.fail(`Expected ':' after property name, found ${describeChar(this.text, this.pos)}`);
      }
      this.pos += 1;
      this.skipWhitespace();
      this.path.push(key);
      this.value(depth + 1);
      this.path.pop();
      this.skipWhitespace();
      const next = this.text.charCodeAt(this.pos);
      if (next === Ch.Comma) {
        const commaOffset = this.pos;
        this.pos += 1;
        this.skipWhitespace();
        if (this.text.charCodeAt(this.pos) === Ch.CloseBrace) {
          this.fail("Trailing comma before '}' is not allowed in JSON", commaOffset);
        }
        continue;
      }
      if (next === Ch.CloseBrace) {
        this.pos += 1;
        return;
      }
      if (next === Ch.Quote) this.fail("Expected ',' between properties (missing comma)");
      if (Number.isNaN(next)) this.fail("Unexpected end of input, expected ',' or '}'");
      this.fail(
        `Expected ',' or '}' after property value, found ${describeChar(this.text, this.pos)}`,
      );
    }
  }

  private array(depth: number): void {
    this.stats.arrays += 1;
    this.pos += 1;
    this.skipWhitespace();
    if (this.text.charCodeAt(this.pos) === Ch.CloseBracket) {
      this.pos += 1;
      return;
    }
    let index = 0;
    for (;;) {
      this.path.push(index);
      this.value(depth + 1);
      this.path.pop();
      index += 1;
      this.skipWhitespace();
      const next = this.text.charCodeAt(this.pos);
      if (next === Ch.Comma) {
        const commaOffset = this.pos;
        this.pos += 1;
        this.skipWhitespace();
        if (this.text.charCodeAt(this.pos) === Ch.CloseBracket) {
          this.fail("Trailing comma before ']' is not allowed in JSON", commaOffset);
        }
        continue;
      }
      if (next === Ch.CloseBracket) {
        this.pos += 1;
        return;
      }
      if (Number.isNaN(next)) this.fail("Unexpected end of input, expected ',' or ']'");
      this.fail(
        `Expected ',' or ']' after array element, found ${describeChar(this.text, this.pos)}`,
      );
    }
  }

  /** Scans a string starting at the opening quote; returns its decoded value. */
  private string(): string {
    const t = this.text;
    const start = this.pos;
    this.pos += 1;
    let hasEscape = false;
    for (;;) {
      const c = t.charCodeAt(this.pos);
      if (Number.isNaN(c)) this.fail('Unterminated string', start);
      if (c === Ch.Quote) {
        this.pos += 1;
        break;
      }
      if (c === Ch.Backslash) {
        hasEscape = true;
        const e = t[this.pos + 1];
        if (e === 'u') {
          const hex = t.slice(this.pos + 2, this.pos + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex))
            this.fail('Invalid unicode escape: expected \\u followed by 4 hex digits');
          this.pos += 6;
          continue;
        }
        if (e === undefined || !'"\\/bfnrt'.includes(e)) {
          this.fail(`Invalid escape sequence '\\${e ?? ''}' in string`);
        }
        this.pos += 2;
        continue;
      }
      if (c < 0x20) {
        this.fail(
          c === Ch.LineFeed
            ? 'Line break inside a string (use \\n or close the quote)'
            : 'Unescaped control character in string',
        );
      }
      this.pos += 1;
    }
    const raw = t.slice(start + 1, this.pos - 1);
    return hasEscape ? (JSON.parse(`"${raw}"`) as string) : raw;
  }

  private number(): void {
    const t = this.text;
    const start = this.pos;
    if (t.charCodeAt(this.pos) === Ch.Minus) this.pos += 1;
    const first = t.charCodeAt(this.pos);
    if (first === Ch.Zero) {
      this.pos += 1;
      const after = t.charCodeAt(this.pos);
      if (after >= Ch.Zero && after <= Ch.Nine)
        this.fail('Numbers cannot have leading zeros', start);
    } else if (first > Ch.Zero && first <= Ch.Nine) {
      while (this.isDigit(t.charCodeAt(this.pos))) this.pos += 1;
    } else {
      this.fail("Invalid number: expected a digit after '-'");
    }
    if (t.charCodeAt(this.pos) === Ch.Dot) {
      this.pos += 1;
      if (!this.isDigit(t.charCodeAt(this.pos)))
        this.fail('Invalid number: expected a digit after the decimal point');
      while (this.isDigit(t.charCodeAt(this.pos))) this.pos += 1;
    }
    const e = t[this.pos];
    if (e === 'e' || e === 'E') {
      this.pos += 1;
      const sign = t.charCodeAt(this.pos);
      if (sign === Ch.Plus || sign === Ch.Minus) this.pos += 1;
      if (!this.isDigit(t.charCodeAt(this.pos)))
        this.fail('Invalid number: expected a digit in the exponent');
      while (this.isDigit(t.charCodeAt(this.pos))) this.pos += 1;
    }
    this.stats.numbers += 1;
  }

  private isDigit(c: number): boolean {
    return c >= Ch.Zero && c <= Ch.Nine;
  }

  private literal(): void {
    const t = this.text;
    for (const [word, kind] of [
      ['true', 'booleans'],
      ['false', 'booleans'],
      ['null', 'nulls'],
    ] as const) {
      if (t.startsWith(word, this.pos)) {
        this.pos += word.length;
        this.stats[kind] += 1;
        return;
      }
    }
    const found =
      /^[A-Za-z_$][\w$]*/.exec(t.slice(this.pos, this.pos + 32))?.[0] ?? t[this.pos] ?? '';
    if (found === 'undefined' || found === 'NaN' || found === 'Infinity')
      this.fail(`'${found}' is not a valid JSON value`);
    const lower = found.toLowerCase();
    const hint = ['true', 'false', 'null'].includes(lower) ? ` (did you mean '${lower}'?)` : '';
    this.fail(`Unexpected token '${found}'${hint}`);
  }
}

/**
 * Full syntax analysis: first error (with line/column), duplicate keys and
 * statistics. Intended for validation UIs; use `parseJson` to obtain values.
 */
export function analyzeJson(text: string, maxDuplicates = 200): JsonAnalysis {
  const scanner = new Scanner(text, maxDuplicates);
  let error: JsonSyntaxIssue | null = null;
  let nestingLimitReached = false;
  try {
    scanner.run();
  } catch (e) {
    if (e instanceof SyntaxFailure) {
      error = { message: e.message, ...positionAt(text, e.offset) };
    } else if (e instanceof NestingLimit || e instanceof RangeError) {
      nestingLimitReached = true;
      error = nativeIssue(text);
    } else {
      throw e;
    }
  }
  return {
    valid: error === null,
    nestingLimitReached,
    error,
    duplicates: scanner.duplicates.map((d) => ({
      key: d.key,
      path: d.path,
      ...positionAt(text, d.offset),
    })),
    duplicateCount: scanner.duplicateCount,
    stats: scanner.stats,
  };
}

/** Validity via the native parser, used beyond the scanner's depth limit. */
function nativeIssue(text: string): JsonSyntaxIssue | null {
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    const offset = Number(/position (\d+)/.exec(message)?.[1] ?? 0);
    return { message, ...positionAt(text, offset) };
  }
}

/** Locates a syntax error precisely (used when JSON.parse fails). */
export function locateJsonError(text: string): JsonSyntaxIssue | null {
  return analyzeJson(text, 0).error;
}

/**
 * Parses JSON using the fast native parser; on failure, re-scans to produce a
 * precise, consistent ParseError (message, line, column) across browsers.
 */
export function parseJsonOrThrow(text: string, label?: string, source?: string): JsonValue {
  try {
    return JSON.parse(text) as JsonValue;
  } catch (nativeError) {
    const issue = locateJsonError(text);
    const prefix = label ? `${label}: ` : '';
    if (issue) {
      throw new ParseError(
        `${prefix}${issue.message} (line ${issue.line}, column ${issue.column})`,
        { line: issue.line, column: issue.column, ...(source ? { source } : {}) },
        nativeError,
      );
    }
    throw new ParseError(
      `${prefix}${nativeError instanceof Error ? nativeError.message : 'Invalid JSON'}`,
      source ? { source } : {},
      nativeError,
    );
  }
}

export type ParseJsonResult = { ok: true; value: JsonValue } | { ok: false; error: ParseError };

export function parseJson(text: string, label?: string): ParseJsonResult {
  try {
    return { ok: true, value: parseJsonOrThrow(text, label) };
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, error };
    throw error;
  }
}
