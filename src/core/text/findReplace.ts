import { ValidationError } from '../errors/AppError';

/** Find and replace with plain text or regular expressions. */

export interface FindOptions {
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  /** Regex only: `^`/`$` match at line breaks (m flag). */
  multiline: boolean;
  /** Regex only: `.` also matches line breaks (s flag). */
  dotAll: boolean;
}

export interface ReplaceOptions extends FindOptions {
  replacement: string;
  /** Turn \n, \t and \\ in the replacement into a newline, tab and backslash. */
  interpretEscapes: boolean;
}

export interface FindMatch {
  index: number;
  length: number;
  /** 1-based. */
  line: number;
  column: number;
  text: string;
  /** Text around the match on its line (for result lists). */
  before: string;
  after: string;
  groups: string[];
}

export interface FindResult {
  matches: FindMatch[];
  total: number;
  /** True when more matches exist than were listed. */
  truncated: boolean;
}

export interface ReplaceResult extends FindResult {
  output: string;
  replacements: number;
}

export const MAX_LISTED_MATCHES = 10_000;
const CONTEXT = 40;

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/** Builds the search expression (always global and Unicode-aware). */
export function buildFindRegExp(o: FindOptions): RegExp {
  if (!o.query) throw new ValidationError('Enter text to find.');
  let source = o.regex ? o.query : escapeRegExp(o.query);
  if (o.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  const flags = `gu${o.caseSensitive ? '' : 'i'}${o.regex && o.multiline ? 'm' : ''}${o.regex && o.dotAll ? 's' : ''}`;
  try {
    return new RegExp(source, flags);
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replace(/^Invalid regular expression: /, '') : '';
    throw new ValidationError(`Invalid regular expression: ${message}`);
  }
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 10) starts.push(i + 1);
    else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) i += 1;
      starts.push(i + 1);
    }
  }
  return starts;
}

function locate(starts: number[], index: number): { line: number; start: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, start: starts[lo] ?? 0 };
}

export function findAll(
  text: string,
  options: FindOptions,
  limit = MAX_LISTED_MATCHES,
): FindResult {
  const re = buildFindRegExp(options);
  const starts = lineStarts(text);
  const matches: FindMatch[] = [];
  let total = 0;
  for (const m of text.matchAll(re)) {
    total += 1;
    if (matches.length >= limit) continue;
    const index = m.index;
    const { line, start } = locate(starts, index);
    const lineEnd = starts[line] ?? text.length + 1;
    const lineText = text.slice(start, lineEnd).replace(/\r?\n$|\r$/, '');
    const col = index - start;
    matches.push({
      index,
      length: m[0].length,
      line,
      column: col + 1,
      text: m[0],
      before: lineText.slice(Math.max(0, col - CONTEXT), col),
      after: lineText.slice(col + m[0].length, col + m[0].length + CONTEXT),
      // Unmatched optional groups are undefined at runtime.
      groups: m.slice(1).map((g: string | undefined) => g ?? ''),
    });
  }
  return { matches, total, truncated: total > matches.length };
}

function unescapeReplacement(text: string): string {
  return text.replace(/\\([nrt\\])/g, (_, c: string) =>
    c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : '\\',
  );
}

/**
 * Replaces every match. With regular expressions the replacement supports `$1`, `$<name>`, `$&`
 * and `$$`; with plain text it is inserted literally.
 */
export function replaceAll(text: string, options: ReplaceOptions): ReplaceResult {
  const found = findAll(text, options);
  const re = buildFindRegExp(options);
  const replacement = options.interpretEscapes
    ? unescapeReplacement(options.replacement)
    : options.replacement;
  const output = options.regex
    ? text.replace(re, replacement)
    : text.replace(re, () => replacement);
  return { ...found, output, replacements: found.total };
}
