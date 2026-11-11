import { isJsonObject, setOwn } from './objects';
import type { JsonObject, JsonValue } from './types';

export type IndentOption = 2 | 4 | 'tab';

export function indentString(indent: IndentOption): string {
  return indent === 'tab' ? '\t' : ' '.repeat(indent);
}

export function formatJson(value: JsonValue, indent: IndentOption = 2): string {
  return JSON.stringify(value, null, indentString(indent));
}

export function minifyJson(value: JsonValue): string {
  return JSON.stringify(value);
}

export interface SortKeysOptions {
  direction?: 'asc' | 'desc';
  /** "item2" before "item10". */
  natural?: boolean;
  caseInsensitive?: boolean;
}

/** Recursively sorts object keys. Array order is preserved (it is meaningful). */
export function sortKeysDeep(value: JsonValue, options: SortKeysOptions = {}): JsonValue {
  const { direction = 'asc', natural = true, caseInsensitive = false } = options;
  const collator = new Intl.Collator('en', {
    numeric: natural,
    sensitivity: caseInsensitive ? 'base' : 'variant',
    caseFirst: 'upper',
  });
  const factor = direction === 'asc' ? 1 : -1;
  const compare = (a: string, b: string) => {
    const r = collator.compare(a, b);
    // Keep a deterministic order for keys equal under the collator (e.g. "a" vs "A").
    return factor * (r !== 0 ? r : a < b ? -1 : a > b ? 1 : 0);
  };

  const visit = (v: JsonValue): JsonValue => {
    if (Array.isArray(v)) return v.map(visit);
    if (!isJsonObject(v)) return v;
    const out: JsonObject = {};
    for (const key of Object.keys(v).sort(compare)) setOwn(out, key, visit(v[key] as JsonValue));
    return out;
  };
  return visit(value);
}

export interface BeautifyOptions {
  indent?: IndentOption;
  sortKeys?: boolean;
  /**
   * Arrays/objects whose children are all primitives are printed on one line
   * when they fit within this width (0 disables inlining).
   */
  maxInlineWidth?: number;
}

function isPrimitive(v: JsonValue): boolean {
  return v === null || typeof v !== 'object';
}

/**
 * Human-friendly printer: like JSON.stringify with indentation, but short
 * arrays/objects of primitives stay on one line, e.g. `"tags": ["a", "b"]`.
 */
export function beautifyJson(value: JsonValue, options: BeautifyOptions = {}): string {
  const { indent = 2, sortKeys = false, maxInlineWidth = 80 } = options;
  const unit = indentString(indent);
  const root = sortKeys ? sortKeysDeep(value) : value;

  const inline = (v: JsonValue): string | null => {
    if (Array.isArray(v)) {
      if (!v.every(isPrimitive)) return null;
      return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
    }
    if (isJsonObject(v)) {
      const keys = Object.keys(v);
      if (!keys.every((k) => isPrimitive(v[k] as JsonValue))) return null;
      return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(v[k])}`).join(', ')} }`;
    }
    return JSON.stringify(v);
  };

  const print = (v: JsonValue, level: number, prefixWidth: number): string => {
    if (isPrimitive(v)) return JSON.stringify(v);
    const pad = unit.repeat(level);
    const childPad = unit.repeat(level + 1);
    if (Array.isArray(v)) {
      if (v.length === 0) return '[]';
      if (maxInlineWidth > 0) {
        const one = inline(v);
        if (one !== null && pad.length + prefixWidth + one.length <= maxInlineWidth) return one;
      }
      return `[\n${v.map((x) => childPad + print(x, level + 1, 0)).join(',\n')}\n${pad}]`;
    }
    const obj = v as JsonObject;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    if (maxInlineWidth > 0) {
      const one = inline(obj);
      if (one !== null && pad.length + prefixWidth + one.length <= maxInlineWidth) return one;
    }
    const lines = keys.map((k) => {
      const keyText = `${JSON.stringify(k)}: `;
      return childPad + keyText + print(obj[k] as JsonValue, level + 1, keyText.length);
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  };

  return print(root, 0, 0);
}

/** UTF-8 byte length of a string. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}
