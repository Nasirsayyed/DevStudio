import {
  MAX as UUID_MAX,
  NIL as UUID_NIL,
  v1,
  v4,
  v5,
  v6,
  v7,
  validate,
  version as uuidVersion,
} from 'uuid';
import { ValidationError } from '../errors/AppError';

export type UuidVersion = 'v4' | 'v7' | 'v1' | 'v6' | 'v5' | 'nil' | 'max';

export const UUID_NAMESPACES = {
  DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  URL: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  OID: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  X500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
} as const;

export const MAX_UUID_COUNT = 1000;

export function generateUuids(
  version: UuidVersion,
  count: number,
  v5Input?: { namespace: string; name: string },
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_UUID_COUNT)
    throw new ValidationError(`Count must be between 1 and ${MAX_UUID_COUNT}.`);
  switch (version) {
    case 'v4':
      return Array.from({ length: count }, () => v4());
    case 'v7':
      return Array.from({ length: count }, () => v7());
    case 'v1':
      return Array.from({ length: count }, () => v1());
    case 'v6':
      return Array.from({ length: count }, () => v6());
    case 'nil':
      return [UUID_NIL];
    case 'max':
      return [UUID_MAX];
    case 'v5': {
      const ns = v5Input?.namespace.trim() ?? '';
      if (!validate(ns))
        throw new ValidationError(
          'The v5 namespace must be a valid UUID (or choose DNS/URL/OID/X500).',
        );
      // v5 is deterministic: the same namespace + name always gives the same UUID.
      return [v5(v5Input?.name ?? '', ns)];
    }
  }
}

/** .NET Guid.ToString() formats. */
export type GuidFormat = 'D' | 'N' | 'B' | 'P' | 'X';

export function formatGuid(uuid: string, format: GuidFormat, uppercase: boolean): string {
  const hex = uuid.replace(/-/g, '');
  const cased = uppercase ? uuid.toUpperCase() : uuid.toLowerCase();
  const h = uppercase ? hex.toUpperCase() : hex.toLowerCase();
  switch (format) {
    case 'D':
      return cased;
    case 'N':
      return h;
    case 'B':
      return `{${cased}}`;
    case 'P':
      return `(${cased})`;
    case 'X': {
      // {0x00000000,0x0000,0x0000,{0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00}}
      const bytes = h.slice(16).match(/../g) ?? [];
      return `{0x${h.slice(0, 8)},0x${h.slice(8, 12)},0x${h.slice(12, 16)},{${bytes.map((b) => `0x${b}`).join(',')}}}`;
    }
  }
}

export interface UuidInfo {
  valid: boolean;
  version: number | null;
  variant: string | null;
  /** Embedded timestamp for time-based versions (1, 6, 7). */
  timestamp: Date | null;
}

/** Validates and inspects a UUID in any common textual form ({…}, (…), no dashes, any case). */
export function inspectUuid(input: string): UuidInfo {
  const hex = input
    .trim()
    .replace(/^[{(]|[})]$/g, '')
    .replace(/-/g, '')
    .toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex))
    return { valid: false, version: null, variant: null, timestamp: null };
  const canonical = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (canonical === UUID_NIL) return { valid: true, version: 0, variant: 'NIL', timestamp: null };
  if (canonical === UUID_MAX) return { valid: true, version: 15, variant: 'MAX', timestamp: null };
  const valid = validate(canonical);
  const variantNibble = parseInt(hex.charAt(16), 16);
  const variant =
    variantNibble >= 0xe
      ? 'Reserved (future)'
      : variantNibble >= 0xc
        ? 'Microsoft (legacy)'
        : variantNibble >= 0x8
          ? 'RFC 9562'
          : 'NCS (legacy)';
  const version = valid ? uuidVersion(canonical) : parseInt(hex.charAt(12), 16);
  let timestamp: Date | null = null;
  // 100-ns intervals since 1582-10-15 for v1/v6; Unix ms for v7.
  const GREGORIAN_OFFSET = 122192928000000000n;
  if (version === 7) timestamp = new Date(parseInt(hex.slice(0, 12), 16));
  else if (version === 1) {
    const t = BigInt(`0x${hex.slice(13, 16)}${hex.slice(8, 12)}${hex.slice(0, 8)}`);
    timestamp = new Date(Number((t - GREGORIAN_OFFSET) / 10000n));
  } else if (version === 6) {
    const t = BigInt(`0x${hex.slice(0, 8)}${hex.slice(8, 12)}${hex.slice(13, 16)}`);
    timestamp = new Date(Number((t - GREGORIAN_OFFSET) / 10000n));
  }
  return { valid, version, variant, timestamp };
}
