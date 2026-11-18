import { queryJsonPath } from '../json/jsonpath';
import type { JsonValue } from '../json/types';
import { tryParseJson } from '../security/safeJsonParse';
import type { Assertion, Extraction } from './model';

/** The parts of a response that assertions and extractions look at. */
export interface ResponseFacts {
  status: number;
  headers: readonly (readonly [string, string])[];
  text: string | null;
  timeMs: number;
}

export interface AssertionResult {
  id: string;
  label: string;
  passed: boolean;
  /** What was found (or why the check could not run). */
  detail: string;
}

export interface ExtractionResult {
  values: Record<string, string>;
  errors: string[];
}

const ASSERTION_LABELS: Record<Assertion['kind'], string> = {
  'status-equals': 'Status is',
  'status-in-range': 'Status in range',
  'json-equals': 'JSON value equals',
  'json-exists': 'JSON path exists',
  'json-contains': 'JSON value contains',
  'header-contains': 'Header contains',
  'body-contains': 'Body contains',
  'time-below': 'Response time below (ms)',
};

export function assertionLabel(kind: Assertion['kind']): string {
  return ASSERTION_LABELS[kind];
}

/** Parses the body as JSON once; `undefined` when it is not JSON. */
function bodyJson(facts: ResponseFacts): JsonValue | undefined {
  if (facts.text === null || !facts.text.trim()) return undefined;
  const parsed = tryParseJson(facts.text);
  return parsed.ok ? (parsed.value as JsonValue) : undefined;
}

/** JSON.stringify returns undefined for undefined and functions (its type says string). */
const stringify: (v: unknown) => string | undefined = JSON.stringify;

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return stringify(v) ?? 'undefined';
}

const show = (v: unknown): string => {
  const s = typeof v === 'string' ? JSON.stringify(v) : canonical(v);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
};

/** Expected JSON values may be written as JSON (`1`, `"a"`, `{"x":1}`) or as plain text. */
function expectedJson(text: string): unknown {
  const parsed = tryParseJson(text);
  return parsed.ok ? parsed.value : text;
}

function header(facts: ResponseFacts, name: string): string | undefined {
  const n = name.trim().toLowerCase();
  const values = facts.headers.filter(([k]) => k.toLowerCase() === n).map(([, v]) => v);
  return values.length ? values.join(', ') : undefined;
}

function firstMatch(
  json: JsonValue | undefined,
  path: string,
): { found: boolean; value?: JsonValue } {
  if (json === undefined) throw new Error('The body is not JSON.');
  const { matches } = queryJsonPath(json, path);
  const first = matches[0];
  return first ? { found: true, value: first.value } : { found: false };
}

function check(
  a: Assertion,
  facts: ResponseFacts,
  json: () => JsonValue | undefined,
): Omit<AssertionResult, 'id' | 'label'> {
  const expected = a.expected.trim();
  switch (a.kind) {
    case 'status-equals': {
      const allowed = expected
        .split(/[\s,|]+/)
        .filter(Boolean)
        .map(Number);
      if (allowed.length === 0 || allowed.some((n) => !Number.isInteger(n)))
        return { passed: false, detail: 'Enter a status code, e.g. 200 or 200, 201.' };
      return { passed: allowed.includes(facts.status), detail: `Status ${String(facts.status)}` };
    }
    case 'status-in-range': {
      const m = /^(\d{3})\s*-\s*(\d{3})$/.exec(expected) ?? /^([1-5])xx$/i.exec(expected);
      if (!m) return { passed: false, detail: 'Enter a range, e.g. 200-299 or 2xx.' };
      const [lo, hi] = m[2]
        ? [Number(m[1]), Number(m[2])]
        : [Number(m[1]) * 100, Number(m[1]) * 100 + 99];
      return {
        passed: facts.status >= lo && facts.status <= hi,
        detail: `Status ${String(facts.status)}`,
      };
    }
    case 'json-exists': {
      const r = firstMatch(json(), a.target);
      return { passed: r.found, detail: r.found ? `Found ${show(r.value)}` : 'No match' };
    }
    case 'json-equals': {
      const r = firstMatch(json(), a.target);
      if (!r.found) return { passed: false, detail: 'No match' };
      return {
        passed: canonical(r.value) === canonical(expectedJson(expected)),
        detail: `Found ${show(r.value)}`,
      };
    }
    case 'json-contains': {
      const r = firstMatch(json(), a.target);
      if (!r.found) return { passed: false, detail: 'No match' };
      const want = expectedJson(expected);
      const passed = Array.isArray(r.value)
        ? r.value.some((item) => canonical(item) === canonical(want))
        : (typeof r.value === 'string' ? r.value : canonical(r.value)).includes(a.expected);
      return { passed, detail: `Found ${show(r.value)}` };
    }
    case 'header-contains': {
      if (!a.target.trim()) return { passed: false, detail: 'Enter a header name.' };
      const v = header(facts, a.target);
      if (v === undefined)
        return { passed: false, detail: 'Header not present (or not exposed by CORS)' };
      return {
        passed: v.toLowerCase().includes(a.expected.toLowerCase()),
        detail: `${a.target.trim()}: ${v}`,
      };
    }
    case 'body-contains':
      if (facts.text === null) return { passed: false, detail: 'The body is binary.' };
      return {
        passed: facts.text.includes(a.expected),
        detail: facts.text.includes(a.expected) ? 'Found' : 'Not found',
      };
    case 'time-below': {
      const limit = Number(expected);
      if (!Number.isFinite(limit) || limit <= 0)
        return { passed: false, detail: 'Enter a number of milliseconds.' };
      return { passed: facts.timeMs < limit, detail: `${String(facts.timeMs)} ms` };
    }
  }
}

/** Runs the enabled assertions. `resolve` substitutes {{variables}} in targets and expectations. */
export function evaluateAssertions(
  assertions: readonly Assertion[],
  facts: ResponseFacts,
  resolve: (text: string) => string = (t) => t,
): AssertionResult[] {
  let cached: { value: JsonValue | undefined } | null = null;
  const json = () => (cached ??= { value: bodyJson(facts) }).value;
  return assertions
    .filter((a) => a.enabled)
    .map((raw) => {
      const a = { ...raw, target: resolve(raw.target), expected: resolve(raw.expected) };
      const target = a.target.trim() ? ` ${a.target.trim()}` : '';
      const label = `${assertionLabel(a.kind)}${target}${a.expected.trim() ? ` ${a.expected.trim()}` : ''}`;
      try {
        return { id: a.id, label, ...check(a, facts, json) };
      } catch (error) {
        return {
          id: a.id,
          label,
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    });
}

const VARIABLE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** Reads values for chained requests (JSONPath, header or status). */
export function extractValues(
  extractions: readonly Extraction[],
  facts: ResponseFacts,
): ExtractionResult {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  let cached: { value: JsonValue | undefined } | null = null;
  for (const e of extractions) {
    if (!e.enabled || !e.variable.trim()) continue;
    const name = e.variable.trim();
    if (!VARIABLE.test(name)) {
      errors.push(`"${name}" is not a valid variable name.`);
      continue;
    }
    try {
      if (e.source === 'status') values[name] = String(facts.status);
      else if (e.source === 'header') {
        const v = header(facts, e.path);
        if (v === undefined) errors.push(`${name}: the header "${e.path}" is not in the response.`);
        else values[name] = v;
      } else {
        const r = firstMatch((cached ??= { value: bodyJson(facts) }).value, e.path);
        if (!r.found) errors.push(`${name}: nothing matches ${e.path}.`);
        else values[name] = typeof r.value === 'string' ? r.value : JSON.stringify(r.value);
      }
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { values, errors };
}
