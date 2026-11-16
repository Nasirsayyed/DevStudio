import { v4 as uuidv4 } from 'uuid';
import { cryptoRandom, randomInt, type RandomSource } from '../random/secureRandom';

/**
 * `{{name}}` variables. Resolution order: runtime (values extracted while running), then the
 * active environment, then the collection. Dynamic variables start with `$`.
 */
export type VariableScope = ReadonlyMap<string, string>;

const VAR = /\{\{\s*([^{}\s]+)\s*\}\}/g;

export const DYNAMIC_VARIABLES = [
  '$guid',
  '$uuid',
  '$timestamp',
  '$isoTimestamp',
  '$randomInt',
] as const;

export interface InterpolationResult {
  text: string;
  /** Variables that had no value (left as {{name}}). */
  missing: string[];
  /** Variables that were used. */
  used: string[];
}

export function dynamicValue(
  name: string,
  now: number,
  random: RandomSource = cryptoRandom,
): string | null {
  switch (name) {
    case '$guid':
    case '$uuid':
      return uuidv4({ random: random(new Uint8Array(16)) });
    case '$timestamp':
      return String(Math.floor(now / 1000));
    case '$isoTimestamp':
      return new Date(now).toISOString();
    case '$randomInt':
      return String(randomInt(1001, random));
    default:
      return null;
  }
}

export function interpolate(
  text: string,
  scopes: readonly VariableScope[],
  options: { now?: number; random?: RandomSource } = {},
): InterpolationResult {
  const missing = new Set<string>();
  const used = new Set<string>();
  const now = options.now ?? Date.now();
  const out = text.replace(VAR, (whole, name: string) => {
    if (name.startsWith('$')) {
      const v = dynamicValue(name, now, options.random);
      if (v !== null) {
        used.add(name);
        return v;
      }
    }
    for (const scope of scopes) {
      const v = scope.get(name);
      if (v !== undefined) {
        used.add(name);
        return v;
      }
    }
    missing.add(name);
    return whole;
  });
  return { text: out, missing: [...missing], used: [...used] };
}

/** Names referenced in a text (for highlighting and "undefined variable" hints). */
export function variablesIn(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(VAR), (m) => m[1] ?? ''))].filter(Boolean);
}
