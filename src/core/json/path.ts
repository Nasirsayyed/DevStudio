import { isContainer } from './objects';
import type { JsonPathSegments, JsonValue, PathSegment } from './types';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** `$.store.book[0]['first name']` */
export function toJsonPath(path: JsonPathSegments): string {
  let out = '$';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (IDENTIFIER.test(seg)) out += `.${seg}`;
    else out += `['${seg.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;
  }
  return out;
}

/** `data.store.book[0]["first name"]` */
export function toJsAccessor(path: JsonPathSegments, root = 'data'): string {
  let out = root;
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (IDENTIFIER.test(seg)) out += `.${seg}`;
    else out += `[${JSON.stringify(seg)}]`;
  }
  return out;
}

/** RFC 6901 JSON Pointer: `/store/book/0/first name` */
export function toJsonPointer(path: JsonPathSegments): string {
  return path.map((seg) => `/${String(seg).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');
}

/** Parses a JSON Pointer (optionally prefixed with "#") into raw string segments. */
export function parseJsonPointer(pointer: string): string[] {
  const p = pointer.startsWith('#') ? decodeURIComponent(pointer.slice(1)) : pointer;
  if (p === '') return [];
  if (!p.startsWith('/')) throw new Error(`Invalid JSON Pointer: ${pointer}`);
  return p
    .slice(1)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Resolves pointer segments against a value, turning indexes into numbers for arrays. */
export function resolvePointerSegments(
  root: JsonValue,
  segments: readonly string[],
): PathSegment[] {
  const out: PathSegment[] = [];
  let current: unknown = root;
  for (const seg of segments) {
    if (Array.isArray(current) && /^\d+$/.test(seg)) {
      const index = Number(seg);
      out.push(index);
      current = current[index];
    } else {
      out.push(seg);
      current = isContainer(current) ? (current as Record<string, unknown>)[seg] : undefined;
    }
  }
  return out;
}

/** Reads the value at a path; returns undefined if any segment is missing. */
export function getAtPath(root: JsonValue, path: JsonPathSegments): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const seg of path) {
    if (current === undefined || !isContainer(current)) return undefined;
    if (Array.isArray(current)) {
      current = typeof seg === 'number' ? current[seg] : undefined;
    } else {
      current = Object.prototype.hasOwnProperty.call(current, seg)
        ? current[String(seg)]
        : undefined;
    }
  }
  return current;
}
