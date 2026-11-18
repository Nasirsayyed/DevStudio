import { ValidationError } from '../errors/AppError';
import { isJsonObject, jsonTypeOf } from './objects';
import type { JsonType, JsonValue, PathSegment } from './types';

export interface SearchOptions {
  query: string;
  scope?: 'keys' | 'values' | 'both';
  mode?: 'contains' | 'exact' | 'regex';
  caseSensitive?: boolean;
  limit?: number;
}

export interface SearchMatch {
  path: PathSegment[];
  matchedOn: 'key' | 'value';
  type: JsonType;
  /** Short string preview of the matched value. */
  preview: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  truncated: boolean;
  /** Total nodes visited. */
  scanned: number;
}

const PREVIEW_LENGTH = 120;

export function previewValue(v: JsonValue, max = PREVIEW_LENGTH): string {
  let text: string;
  if (Array.isArray(v)) text = `Array(${v.length})`;
  else if (isJsonObject(v)) text = `Object{${Object.keys(v).length}}`;
  else text = JSON.stringify(v);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildMatcher(options: SearchOptions): (text: string) => boolean {
  const { query, mode = 'contains', caseSensitive = false } = options;
  if (mode === 'regex') {
    let re: RegExp;
    try {
      re = new RegExp(query, caseSensitive ? 'u' : 'iu');
    } catch (error) {
      throw new ValidationError(
        `Invalid regular expression: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return (t) => re.test(t);
  }
  const q = caseSensitive ? query : query.toLowerCase();
  if (mode === 'exact') return (t) => (caseSensitive ? t : t.toLowerCase()) === q;
  return (t) => (caseSensitive ? t : t.toLowerCase()).includes(q);
}

/** Finds keys and/or values matching a query anywhere in the document. */
export function searchJson(root: JsonValue, options: SearchOptions): SearchResult {
  const { scope = 'both', limit = 1000 } = options;
  if (!options.query) return { matches: [], truncated: false, scanned: 0 };
  const matches = buildMatcher(options);
  const results: SearchMatch[] = [];
  let truncated = false;
  let scanned = 0;
  // Iterative traversal (no recursion limits on deep documents).
  const stack: { value: JsonValue; path: PathSegment[] }[] = [{ value: root, path: [] }];
  while (stack.length > 0) {
    const { value, path } = stack.pop() as { value: JsonValue; path: PathSegment[] };
    scanned += 1;
    const key = path[path.length - 1];
    if (scope !== 'values' && typeof key === 'string' && matches(key)) {
      results.push({
        path,
        matchedOn: 'key',
        type: jsonTypeOf(value),
        preview: previewValue(value),
      });
    } else if (
      scope !== 'keys' &&
      (value === null || typeof value !== 'object') &&
      matches(value === null ? 'null' : String(value))
    ) {
      results.push({
        path,
        matchedOn: 'value',
        type: jsonTypeOf(value),
        preview: previewValue(value),
      });
    }
    if (results.length >= limit) {
      truncated = true;
      break;
    }
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--)
        stack.push({ value: value[i] as JsonValue, path: [...path, i] });
    } else if (isJsonObject(value)) {
      const keys = Object.keys(value);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i] as string;
        stack.push({ value: value[k] as JsonValue, path: [...path, k] });
      }
    }
  }
  return { matches: results, truncated, scanned };
}
