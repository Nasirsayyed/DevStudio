import { ValidationError } from '../errors/AppError';
import { type RandomSource, cryptoRandom, randomFromCharset } from '../random/secureRandom';

export const CHARSET_PRESETS = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  lowercase: 'abcdefghijklmnopqrstuvwxyz0123456789',
  numeric: '0123456789',
  hex: '0123456789abcdef',
  HEX: '0123456789ABCDEF',
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  /** Crockford's Base32: no I, L, O, U — easy to read aloud. */
  crockford: '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
} as const;

export type CharsetPreset = keyof typeof CHARSET_PRESETS | 'custom';

export const MAX_RANDOM_LENGTH = 4096;
export const MAX_RANDOM_COUNT = 1000;

export function generateRandomStrings(
  options: { preset: CharsetPreset; custom: string; length: number; count: number },
  source: RandomSource = cryptoRandom,
): string[] {
  const { preset, custom, length, count } = options;
  if (!Number.isInteger(length) || length < 1 || length > MAX_RANDOM_LENGTH)
    throw new ValidationError(`Length must be between 1 and ${MAX_RANDOM_LENGTH}.`);
  if (!Number.isInteger(count) || count < 1 || count > MAX_RANDOM_COUNT)
    throw new ValidationError(`Count must be between 1 and ${MAX_RANDOM_COUNT}.`);
  const charset = preset === 'custom' ? custom : CHARSET_PRESETS[preset];
  if (preset === 'custom' && new Set(Array.from(custom)).size < 2)
    throw new ValidationError('A custom character set needs at least 2 different characters.');
  return Array.from({ length: count }, () => randomFromCharset(charset, length, source));
}

/** Number of distinct characters in a preset/custom set. */
export function charsetSize(preset: CharsetPreset, custom: string): number {
  return new Set(Array.from(preset === 'custom' ? custom : CHARSET_PRESETS[preset])).size;
}
