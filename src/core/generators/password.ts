import { ValidationError } from '../errors/AppError';
import {
  type RandomSource,
  cryptoRandom,
  randomFromCharset,
  secureShuffle,
} from '../random/secureRandom';

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** Remove look-alike characters (I l 1 O 0 o and | ` ' " etc.). */
  excludeAmbiguous: boolean;
  /** Characters to never use. */
  exclude: string;
  /** Guarantee at least one character from every selected class. */
  requireEach: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
  exclude: '',
  requireEach: true,
};

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 256;

const CLASSES = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>/?~|`\'"\\',
} as const;
const AMBIGUOUS = new Set(Array.from('Il1O0o|`\'"'));

function classSets(o: PasswordOptions): string[][] {
  const excluded = new Set(Array.from(o.exclude));
  return (Object.keys(CLASSES) as (keyof typeof CLASSES)[])
    .filter((k) => o[k])
    .map((k) =>
      Array.from(CLASSES[k]).filter(
        (c) => !excluded.has(c) && !(o.excludeAmbiguous && AMBIGUOUS.has(c)),
      ),
    )
    .filter((set) => set.length > 0);
}

/** Size of the character pool for the given options. */
export function passwordPoolSize(o: PasswordOptions): number {
  return classSets(o).reduce((n, s) => n + s.length, 0);
}

export function generatePassword(o: PasswordOptions, source: RandomSource = cryptoRandom): string {
  if (
    !Number.isInteger(o.length) ||
    o.length < MIN_PASSWORD_LENGTH ||
    o.length > MAX_PASSWORD_LENGTH
  ) {
    throw new ValidationError(
      `Length must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH}.`,
    );
  }
  const sets = classSets(o);
  if (sets.length === 0) throw new ValidationError('Select at least one character type.');
  const pool = sets.flat();
  if (!o.requireEach) return randomFromCharset(pool, o.length, source);
  if (o.length < sets.length)
    throw new ValidationError(
      `Length must be at least ${sets.length} to include every selected type.`,
    );
  const required = sets.map((s) => randomFromCharset(s, 1, source));
  const rest = Array.from(randomFromCharset(pool, o.length - required.length, source));
  return secureShuffle([...required, ...rest], source).join('');
}

export interface Strength {
  bits: number;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  /** 0–4, for meters. */
  score: 0 | 1 | 2 | 3 | 4;
}

/** Entropy of a randomly generated secret: length × log2(pool size). */
export function entropyStrength(length: number, poolSize: number): Strength {
  const bits = poolSize > 1 ? Math.round(length * Math.log2(poolSize)) : 0;
  if (bits < 28) return { bits, label: 'Very weak', score: 0 };
  if (bits < 45) return { bits, label: 'Weak', score: 1 };
  if (bits < 60) return { bits, label: 'Fair', score: 2 };
  if (bits < 100) return { bits, label: 'Strong', score: 3 };
  return { bits, label: 'Very strong', score: 4 };
}
