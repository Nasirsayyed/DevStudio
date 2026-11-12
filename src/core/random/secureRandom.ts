import { ValidationError } from '../errors/AppError';

/** Fills a buffer with random bytes. Injectable so generators are testable. */
export type RandomSource = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

/** Cryptographically secure randomness from the Web Crypto API. */
export const cryptoRandom: RandomSource = (bytes) => {
  crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Uniform random integer in [0, maxExclusive) using rejection sampling, so
 * there is no modulo bias (important for passwords and tokens).
 */
export function randomInt(maxExclusive: number, source: RandomSource = cryptoRandom): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 32) {
    throw new ValidationError('Random range must be between 1 and 2^32.');
  }
  const limit = Math.floor(2 ** 32 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  for (;;) {
    source(new Uint8Array(buf.buffer));
    const v = buf[0] ?? 0;
    if (v < limit) return v % maxExclusive;
  }
}

/** Picks `length` characters uniformly from `charset` (supports any Unicode characters). */
export function randomFromCharset(
  charset: string | readonly string[],
  length: number,
  source: RandomSource = cryptoRandom,
): string {
  const chars = typeof charset === 'string' ? Array.from(new Set(Array.from(charset))) : charset;
  if (chars.length === 0) throw new ValidationError('The character set is empty.');
  let out = '';
  for (let i = 0; i < length; i++) out += chars[randomInt(chars.length, source)] ?? '';
  return out;
}

/** Fisher–Yates shuffle with secure randomness. */
export function secureShuffle<T>(items: readonly T[], source: RandomSource = cryptoRandom): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, source);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}
