import CryptoJS from 'crypto-js';
import { ValidationError } from '../errors/AppError';

/**
 * Hash algorithms. Note: crypto-js's "SHA3" implements the original Keccak
 * (pre-FIPS-202 padding, as used by Ethereum), so it is labelled Keccak here —
 * its output differs from standard SHA3-256/512.
 */
export const HASH_ALGORITHMS = [
  'MD5',
  'SHA-1',
  'SHA-224',
  'SHA-256',
  'SHA-384',
  'SHA-512',
  'Keccak-256',
  'Keccak-512',
  'RIPEMD-160',
] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

/** Algorithms considered broken for security purposes (fine for checksums). */
export const WEAK_ALGORITHMS: ReadonlySet<HashAlgorithm> = new Set(['MD5', 'SHA-1']);

export type HashEncoding = 'hex' | 'HEX' | 'base64';

type Hasher = { update(data: CryptoJS.lib.WordArray): unknown; finalize(): CryptoJS.lib.WordArray };

function createHasher(alg: HashAlgorithm, hmacKey?: CryptoJS.lib.WordArray): Hasher {
  const algo = {
    MD5: CryptoJS.algo.MD5,
    'SHA-1': CryptoJS.algo.SHA1,
    'SHA-224': CryptoJS.algo.SHA224,
    'SHA-256': CryptoJS.algo.SHA256,
    'SHA-384': CryptoJS.algo.SHA384,
    'SHA-512': CryptoJS.algo.SHA512,
    'Keccak-256': CryptoJS.algo.SHA3,
    'Keccak-512': CryptoJS.algo.SHA3,
    'RIPEMD-160': CryptoJS.algo.RIPEMD160,
  }[alg];
  const cfg =
    alg === 'Keccak-256'
      ? { outputLength: 256 }
      : alg === 'Keccak-512'
        ? { outputLength: 512 }
        : undefined;
  if (hmacKey) {
    // HMAC over Keccak needs the hasher config; crypto-js HMAC uses the algorithm's defaults.
    if (cfg) throw new ValidationError('HMAC is not available for Keccak in this tool.');
    return CryptoJS.algo.HMAC.create(algo, hmacKey);
  }
  return cfg ? algo.create(cfg) : algo.create();
}

function encode(words: CryptoJS.lib.WordArray, encoding: HashEncoding): string {
  if (encoding === 'base64') return words.toString(CryptoJS.enc.Base64);
  const hex = words.toString(CryptoJS.enc.Hex);
  return encoding === 'HEX' ? hex.toUpperCase() : hex;
}

/** Converts bytes to a crypto-js WordArray. */
export function wordsFromBytes(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++)
    words[i >>> 2] = (words[i >>> 2] ?? 0) | ((bytes[i] ?? 0) << (24 - (i % 4) * 8));
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

export interface MultiHasher {
  update(chunk: Uint8Array): void;
  digest(encoding: HashEncoding): Partial<Record<HashAlgorithm, string>>;
}

/** Streams data through several algorithms at once (used for large files). */
export function createMultiHasher(
  algorithms: readonly HashAlgorithm[],
  hmacKey?: string,
): MultiHasher {
  if (algorithms.length === 0) throw new ValidationError('Select at least one algorithm.');
  const key =
    hmacKey !== undefined && hmacKey !== '' ? CryptoJS.enc.Utf8.parse(hmacKey) : undefined;
  const hashers = algorithms
    .filter((a) => !(key && a.startsWith('Keccak')))
    .map((a) => [a, createHasher(a, key)] as const);
  return {
    update(chunk) {
      const words = wordsFromBytes(chunk);
      for (const [, h] of hashers) h.update(words);
    },
    digest(encoding) {
      const out: Partial<Record<HashAlgorithm, string>> = {};
      for (const [alg, h] of hashers) out[alg] = encode(h.finalize(), encoding);
      return out;
    },
  };
}

/** Hashes UTF-8 text with every requested algorithm (optionally as HMAC). */
export function hashText(
  text: string,
  algorithms: readonly HashAlgorithm[],
  options: { hmacKey?: string; encoding?: HashEncoding } = {},
): Partial<Record<HashAlgorithm, string>> {
  const h = createMultiHasher(algorithms, options.hmacKey);
  h.update(new TextEncoder().encode(text));
  return h.digest(options.encoding ?? 'hex');
}

/** Constant-time-ish comparison of two digests, ignoring case and surrounding whitespace. */
export function digestsEqual(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x.length !== y.length || x.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
