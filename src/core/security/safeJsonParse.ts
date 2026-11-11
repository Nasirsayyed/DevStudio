import { ParseError } from '../errors/AppError';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

/**
 * JSON.parse that strips prototype-pollution vectors (`__proto__`,
 * `constructor`, `prototype` keys) from every object in the tree.
 * Use for ALL untrusted input (imports, localStorage, uploaded files).
 */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text, (key, value: unknown) => (isForbiddenKey(key) ? undefined : value));
  } catch (error) {
    throw new ParseError(error instanceof Error ? error.message : 'Invalid JSON', {}, error);
  }
}

/** Non-throwing variant. */
export function tryParseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: ParseError } {
  try {
    return { ok: true, value: safeJsonParse(text) };
  } catch (error) {
    return { ok: false, error: error as ParseError };
  }
}
