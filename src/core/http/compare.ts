import { type DiffResult, diffJson } from '../json/diff';
import { formatJson, sortKeysDeep } from '../json/format';
import type { JsonValue } from '../json/types';
import { tryParseJson } from '../security/safeJsonParse';

/** One side of a comparison (a history entry or a pasted body). */
export interface ResponseSide {
  status: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  contentType: string;
  headers: readonly (readonly [string, string])[];
  body: string | null;
}

export interface MetaRow {
  label: string;
  left: string;
  right: string;
  different: boolean;
}

export interface HeaderRow {
  name: string;
  left: string | null;
  right: string | null;
  kind: 'same' | 'added' | 'removed' | 'changed';
}

export type BodyComparison =
  | { kind: 'json'; diff: DiffResult; left: string; right: string }
  | { kind: 'text'; equal: boolean; left: string; right: string };

export interface ResponseComparison {
  meta: MetaRow[];
  headers: HeaderRow[];
  body: BodyComparison;
}

/** Headers that differ on every response and would only add noise. */
export const VOLATILE_HEADERS = new Set([
  'date',
  'age',
  'expires',
  'x-request-id',
  'x-amzn-requestid',
  'cf-ray',
  'etag',
  'last-modified',
  'server-timing',
  'x-runtime',
]);

const show = (v: number | null, unit = '') => (v === null ? '—' : `${String(v)}${unit}`);

function headerMap(headers: ResponseSide['headers']): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of headers) {
    const key = k.toLowerCase();
    m.set(key, m.has(key) ? `${m.get(key) ?? ''}, ${v}` : v);
  }
  return m;
}

function parseJson(text: string | null): JsonValue | undefined {
  if (text === null || !text.trim()) return undefined;
  const r = tryParseJson(text);
  return r.ok ? (r.value as JsonValue) : undefined;
}

export function compareResponses(
  left: ResponseSide,
  right: ResponseSide,
  options: {
    ignoreKeyOrder?: boolean;
    ignoreVolatileHeaders?: boolean;
    arrayMode?: 'index' | 'unordered';
  } = {},
): ResponseComparison {
  const { ignoreKeyOrder = true, ignoreVolatileHeaders = true, arrayMode = 'index' } = options;
  const meta: MetaRow[] = [
    {
      label: 'Status',
      left: show(left.status),
      right: show(right.status),
      different: left.status !== right.status,
    },
    {
      label: 'Content type',
      left: left.contentType || '—',
      right: right.contentType || '—',
      different: left.contentType.toLowerCase() !== right.contentType.toLowerCase(),
    },
    {
      label: 'Size',
      left: show(left.sizeBytes, ' B'),
      right: show(right.sizeBytes, ' B'),
      different: left.sizeBytes !== right.sizeBytes,
    },
    {
      label: 'Time',
      left: show(left.durationMs, ' ms'),
      right: show(right.durationMs, ' ms'),
      different: false,
    },
  ];

  const l = headerMap(left.headers);
  const r = headerMap(right.headers);
  const names = [...new Set([...l.keys(), ...r.keys()])]
    .filter((n) => !(ignoreVolatileHeaders && VOLATILE_HEADERS.has(n)))
    .sort();
  const headers: HeaderRow[] = names.map((name) => {
    const a = l.get(name) ?? null;
    const b = r.get(name) ?? null;
    return {
      name,
      left: a,
      right: b,
      kind: a === null ? 'added' : b === null ? 'removed' : a === b ? 'same' : 'changed',
    };
  });

  const lj = parseJson(left.body);
  const rj = parseJson(right.body);
  let body: BodyComparison;
  if (lj !== undefined && rj !== undefined) {
    const pretty = (v: JsonValue) => formatJson(ignoreKeyOrder ? sortKeysDeep(v) : v, 2);
    body = {
      kind: 'json',
      diff: diffJson(lj, rj, { arrayMode, maxEntries: 1000 }),
      left: pretty(lj),
      right: pretty(rj),
    };
  } else {
    const a = left.body ?? '';
    const b = right.body ?? '';
    body = { kind: 'text', equal: a === b, left: a, right: b };
  }
  return { meta, headers, body };
}
