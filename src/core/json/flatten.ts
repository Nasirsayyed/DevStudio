import { ValidationError } from '../errors/AppError';
import { isJsonObject, setOwn } from './objects';
import type { JsonObject, JsonValue, PathSegment } from './types';

export type ArrayNotation = 'dot' | 'bracket';

export interface FlattenOptions {
  delimiter?: string;
  /** `a.0.b` (dot) or `a[0].b` (bracket). */
  arrayNotation?: ArrayNotation;
}

export interface FlattenResult {
  value: JsonObject;
  /** Keys that contain the delimiter and therefore cannot be unflattened unambiguously. */
  ambiguousKeys: string[];
}

export function flattenJson(value: JsonValue, options: FlattenOptions = {}): FlattenResult {
  const { delimiter = '.', arrayNotation = 'dot' } = options;
  if (!delimiter) throw new ValidationError('The delimiter cannot be empty.');
  if (value === null || typeof value !== 'object') {
    throw new ValidationError('Flatten needs an object or array at the root.');
  }
  const out: JsonObject = {};
  const ambiguous = new Set<string>();

  const join = (prefix: string, seg: PathSegment): string => {
    if (typeof seg === 'number') {
      if (arrayNotation === 'bracket') return `${prefix}[${seg}]`;
      return prefix ? `${prefix}${delimiter}${seg}` : String(seg);
    }
    if (seg.includes(delimiter) || (arrayNotation === 'bracket' && /\[\d+\]/.test(seg)))
      ambiguous.add(seg);
    return prefix ? `${prefix}${delimiter}${seg}` : seg;
  };

  const visit = (v: JsonValue, prefix: string) => {
    if (Array.isArray(v)) {
      if (v.length === 0 && prefix) setOwn(out, prefix, []);
      v.forEach((item, i) => {
        visit(item, join(prefix, i));
      });
      return;
    }
    if (isJsonObject(v)) {
      const keys = Object.keys(v);
      if (keys.length === 0 && prefix) setOwn(out, prefix, {});
      for (const k of keys) visit(v[k] as JsonValue, join(prefix, k));
      return;
    }
    setOwn(out, prefix, v);
  };
  visit(value, '');
  return { value: out, ambiguousKeys: [...ambiguous] };
}

export interface UnflattenOptions {
  delimiter?: string;
  /** Turn objects whose keys are exactly 0..n-1 into arrays. */
  detectArrays?: boolean;
}

interface Node {
  leaf?: { value: JsonValue };
  children?: Map<string, Node>;
}

function splitKey(key: string, delimiter: string): string[] {
  const segments: string[] = [];
  for (const part of key.split(delimiter)) {
    // Support bracket notation: "items[0][1]" → items, 0, 1
    const m = /^(.*?)((?:\[\d+\])+)$/.exec(part);
    if (m) {
      if (m[1]) segments.push(m[1]);
      for (const idx of (m[2] ?? '').matchAll(/\[(\d+)\]/g)) segments.push(idx[1] ?? '');
    } else {
      segments.push(part);
    }
  }
  return segments;
}

/** Rebuilds nested JSON from a flat object of delimited keys. */
export function unflattenJson(value: JsonValue, options: UnflattenOptions = {}): JsonValue {
  const { delimiter = '.', detectArrays = true } = options;
  if (!delimiter) throw new ValidationError('The delimiter cannot be empty.');
  if (!isJsonObject(value))
    throw new ValidationError('Unflatten needs a flat JSON object at the root.');

  const root: Node = { children: new Map() };
  for (const key of Object.keys(value)) {
    const segments = splitKey(key, delimiter);
    let node = root;
    segments.forEach((seg, i) => {
      if (node.leaf) {
        throw new ValidationError(
          `Conflicting keys: "${segments.slice(0, i).join(delimiter)}" is both a value and a parent of "${key}".`,
        );
      }
      node.children ??= new Map();
      let child = node.children.get(seg);
      if (!child) {
        child = {};
        node.children.set(seg, child);
      }
      node = child;
    });
    if (node.children && node.children.size > 0) {
      throw new ValidationError(
        `Conflicting keys: "${key}" is both a value and a parent of other keys.`,
      );
    }
    node.leaf = { value: value[key] as JsonValue };
  }

  const build = (node: Node): JsonValue => {
    if (node.leaf) return node.leaf.value;
    const entries = [...(node.children ?? new Map<string, Node>()).entries()];
    const isArray =
      detectArrays &&
      entries.length > 0 &&
      entries.every(([k]) => /^(0|[1-9]\d*)$/.test(k)) &&
      entries.every(([k]) => Number(k) < entries.length);
    if (isArray) {
      const arr: JsonValue[] = new Array<JsonValue>(entries.length).fill(null);
      for (const [k, child] of entries) arr[Number(k)] = build(child);
      return arr;
    }
    const obj: JsonObject = {};
    for (const [k, child] of entries) setOwn(obj, k, build(child));
    return obj;
  };
  return build(root);
}
