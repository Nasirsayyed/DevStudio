import { isJsonObject, jsonTypeOf } from './objects';
import { toJsonPointer } from './path';
import { previewValue } from './search';
import type { JsonType, JsonValue, PathSegment } from './types';

export interface TreeRow {
  /** JSON Pointer of the node ("" for the root) — stable row id. */
  id: string;
  depth: number;
  /** Property name / array index; null for the root. */
  name: PathSegment | null;
  path: PathSegment[];
  type: JsonType;
  /** Primitive display text, or summary for containers. */
  preview: string;
  childCount: number;
  expandable: boolean;
  expanded: boolean;
}

function childEntries(value: JsonValue): [PathSegment, JsonValue][] {
  if (Array.isArray(value)) return value.map((v, i) => [i, v]);
  if (isJsonObject(value)) return Object.keys(value).map((k) => [k, value[k] as JsonValue]);
  return [];
}

/** Flattens the visible part of a JSON tree into rows (for virtualized rendering). */
export function buildTreeRows(
  root: JsonValue,
  expanded: ReadonlySet<string>,
  maxRows = 500_000,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const stack: {
    value: JsonValue;
    name: PathSegment | null;
    path: PathSegment[];
    depth: number;
  }[] = [{ value: root, name: null, path: [], depth: 0 }];
  while (stack.length > 0 && rows.length < maxRows) {
    const node = stack.pop() as (typeof stack)[number];
    const type = jsonTypeOf(node.value);
    const container = type === 'object' || type === 'array';
    const id = toJsonPointer(node.path);
    const children = container ? childEntries(node.value) : [];
    const isExpanded = container && expanded.has(id);
    rows.push({
      id,
      depth: node.depth,
      name: node.name,
      path: node.path,
      type,
      preview: container
        ? type === 'array'
          ? `[${children.length}]`
          : `{${children.length}}`
        : previewValue(node.value, 200),
      childCount: children.length,
      expandable: container && children.length > 0,
      expanded: isExpanded,
    });
    if (isExpanded) {
      for (let i = children.length - 1; i >= 0; i--) {
        const [name, value] = children[i] as [PathSegment, JsonValue];
        stack.push({ value, name, path: [...node.path, name], depth: node.depth + 1 });
      }
    }
  }
  return rows;
}

/** Ids of all containers up to `maxDepth` (root = depth 0), capped for very large documents. */
export function collectContainerIds(
  root: JsonValue,
  maxDepth = Number.POSITIVE_INFINITY,
  limit = 100_000,
): Set<string> {
  const ids = new Set<string>();
  const stack: { value: JsonValue; path: PathSegment[]; depth: number }[] = [
    { value: root, path: [], depth: 0 },
  ];
  while (stack.length > 0 && ids.size < limit) {
    const { value, path, depth } = stack.pop() as (typeof stack)[number];
    if (depth > maxDepth || value === null || typeof value !== 'object') continue;
    ids.add(toJsonPointer(path));
    for (const [name, child] of childEntries(value)) {
      if (child !== null && typeof child === 'object')
        stack.push({ value: child, path: [...path, name], depth: depth + 1 });
    }
  }
  return ids;
}

/** Ids of all ancestors of a path (to reveal a node). */
export function ancestorIds(path: readonly PathSegment[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i < path.length; i++) ids.push(toJsonPointer(path.slice(0, i)));
  return ids;
}
