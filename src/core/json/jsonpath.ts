import { JSONPath } from 'jsonpath-plus';
import { ValidationError } from '../errors/AppError';
import { isContainer } from './objects';
import { toJsonPath } from './path';
import type { JsonValue, PathSegment } from './types';

export interface JsonPathMatch {
  path: PathSegment[];
  jsonPath: string;
  value: JsonValue;
}

export interface JsonPathResult {
  matches: JsonPathMatch[];
}

interface RawResult {
  path: string;
  value: JsonValue;
}

/**
 * Evaluates a JSONPath expression. Filter expressions run through jsonpath-plus'
 * "safe" evaluator (a sandboxed interpreter), never `eval`/`new Function`.
 */
export function queryJsonPath(root: JsonValue, expression: string): JsonPathResult {
  const expr = expression.trim();
  if (!expr) throw new ValidationError('Enter a JSONPath expression, e.g. $.store.book[*].title');
  if (!expr.startsWith('$'))
    throw new ValidationError('JSONPath expressions must start with "$" (the root).');
  let raw: RawResult[];
  try {
    raw = JSONPath({
      path: expr,
      json: root,
      resultType: 'all',
      eval: 'safe',
      wrap: true,
    }) as RawResult[];
  } catch (error) {
    throw new ValidationError(
      `Invalid JSONPath expression: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const matches = raw.map((r) => {
    const segments = JSONPath.toPathArray(r.path).slice(1).map(String);
    const path: PathSegment[] = [];
    let current: unknown = root;
    for (const seg of segments) {
      if (Array.isArray(current) && /^\d+$/.test(seg)) {
        path.push(Number(seg));
        current = current[Number(seg)];
      } else {
        path.push(seg);
        current = isContainer(current) ? (current as Record<string, unknown>)[seg] : undefined;
      }
    }
    return { path, jsonPath: toJsonPath(path), value: r.value };
  });
  return { matches };
}
