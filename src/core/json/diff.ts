import { isJsonObject, jsonTypeOf } from './objects';
import type { JsonType, JsonValue, PathSegment } from './types';

export type DiffKind = 'added' | 'removed' | 'changed' | 'type-changed';

export interface DiffEntry {
  kind: DiffKind;
  path: PathSegment[];
  left?: JsonValue;
  right?: JsonValue;
  leftType?: JsonType;
  rightType?: JsonType;
}

export interface DiffOptions {
  /** `index`: compare arrays position by position. `unordered`: match equal items regardless of order. */
  arrayMode?: 'index' | 'unordered';
  maxEntries?: number;
}

export interface DiffResult {
  equal: boolean;
  entries: DiffEntry[];
  truncated: boolean;
  summary: Record<DiffKind, number>;
}

/** Canonical representation (sorted keys) used for unordered array matching. */
function canonical(v: JsonValue): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isJsonObject(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k] as JsonValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

class LimitReached extends Error {}

/** Structural JSON comparison: missing/extra properties, value and type differences. */
export function diffJson(left: JsonValue, right: JsonValue, options: DiffOptions = {}): DiffResult {
  const { arrayMode = 'index', maxEntries = 5000 } = options;
  const entries: DiffEntry[] = [];
  const summary: Record<DiffKind, number> = { added: 0, removed: 0, changed: 0, 'type-changed': 0 };
  let truncated = false;

  const push = (entry: DiffEntry) => {
    summary[entry.kind] += 1;
    if (entries.length >= maxEntries) {
      truncated = true;
      throw new LimitReached();
    }
    entries.push(entry);
  };

  const visit = (a: JsonValue, b: JsonValue, path: PathSegment[]) => {
    const ta = jsonTypeOf(a);
    const tb = jsonTypeOf(b);
    if (ta !== tb) {
      push({ kind: 'type-changed', path, left: a, right: b, leftType: ta, rightType: tb });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (arrayMode === 'unordered') {
        compareUnordered(a, b, path);
        return;
      }
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i++) {
        if (i >= b.length)
          push({ kind: 'removed', path: [...path, i], left: a[i], leftType: jsonTypeOf(a[i]) });
        else if (i >= a.length)
          push({ kind: 'added', path: [...path, i], right: b[i], rightType: jsonTypeOf(b[i]) });
        else visit(a[i] as JsonValue, b[i] as JsonValue, [...path, i]);
      }
      return;
    }
    if (isJsonObject(a) && isJsonObject(b)) {
      for (const key of Object.keys(a)) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) {
          push({
            kind: 'removed',
            path: [...path, key],
            left: a[key],
            leftType: jsonTypeOf(a[key]),
          });
        } else {
          visit(a[key] as JsonValue, b[key] as JsonValue, [...path, key]);
        }
      }
      for (const key of Object.keys(b)) {
        if (!Object.prototype.hasOwnProperty.call(a, key)) {
          push({
            kind: 'added',
            path: [...path, key],
            right: b[key],
            rightType: jsonTypeOf(b[key]),
          });
        }
      }
      return;
    }
    if (a !== b) push({ kind: 'changed', path, left: a, right: b, leftType: ta, rightType: tb });
  };

  const compareUnordered = (a: JsonValue[], b: JsonValue[], path: PathSegment[]) => {
    const remaining = new Map<string, number[]>();
    b.forEach((item, i) => {
      const key = canonical(item);
      remaining.set(key, [...(remaining.get(key) ?? []), i]);
    });
    const unmatchedLeft: number[] = [];
    a.forEach((item, i) => {
      const bucket = remaining.get(canonical(item));
      if (bucket && bucket.length > 0) bucket.shift();
      else unmatchedLeft.push(i);
    });
    const unmatchedRight = [...remaining.values()].flat().sort((x, y) => x - y);
    for (const i of unmatchedLeft)
      push({ kind: 'removed', path: [...path, i], left: a[i], leftType: jsonTypeOf(a[i]) });
    for (const i of unmatchedRight)
      push({ kind: 'added', path: [...path, i], right: b[i], rightType: jsonTypeOf(b[i]) });
  };

  try {
    visit(left, right, []);
  } catch (e) {
    if (!(e instanceof LimitReached)) throw e;
  }
  const total = summary.added + summary.removed + summary.changed + summary['type-changed'];
  return { equal: total === 0, entries, truncated, summary };
}
