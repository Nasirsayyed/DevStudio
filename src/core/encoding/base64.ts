import { ValidationError } from '../errors/AppError';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63);
    out += b1 === undefined ? '=' : ALPHABET.charAt((n >> 6) & 63);
    out += b2 === undefined ? '=' : ALPHABET.charAt(n & 63);
  }
  return urlSafe ? out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : out;
}

export interface EncodeOptions {
  urlSafe?: boolean;
  /** Insert line breaks every N characters (76 = MIME, 64 = PEM). 0 = none. */
  lineLength?: 0 | 64 | 76;
}

/** Encodes text as UTF-8 then Base64 (handles emoji and all Unicode). */
export function encodeBase64(text: string, options: EncodeOptions = {}): string {
  const encoded = bytesToBase64(new TextEncoder().encode(text), options.urlSafe);
  const n = options.lineLength ?? 0;
  return n > 0 ? (encoded.match(new RegExp(`.{1,${n}}`, 'g')) ?? []).join('\n') : encoded;
}

export interface DecodedBase64 {
  bytes: Uint8Array;
  /** Decoded text, or null when the bytes are not valid UTF-8 (binary data). */
  text: string | null;
  /** Input used the URL-safe alphabet (- and _). */
  urlSafe: boolean;
}

/**
 * Decodes standard or URL-safe Base64. Whitespace and missing padding are
 * tolerated; invalid characters are reported with their position.
 */
export function decodeBase64(input: string): DecodedBase64 {
  const trimmed = input.replace(/^data:[^,]*;base64,/i, '');
  const compact = trimmed.replace(/\s+/g, '');
  const bad = /[^A-Za-z0-9+/\-_=]/.exec(compact);
  if (bad) {
    const ch = bad[0];
    throw new ValidationError(
      `Invalid Base64 character "${ch === '\u0000' ? '\\0' : ch}" at position ${bad.index + 1}.`,
    );
  }
  const urlSafe = /[-_]/.test(compact);
  const firstPad = compact.indexOf('=');
  if (firstPad >= 0 && !/^=+$/.test(compact.slice(firstPad)))
    throw new ValidationError('Padding ("=") may only appear at the end.');
  const body = compact.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (body.length % 4 === 1)
    throw new ValidationError(
      'Invalid Base64 length: the input is truncated or has an extra character.',
    );
  const bytes = new Uint8Array(Math.floor((body.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let j = 0;
  for (const c of body) {
    buffer = (buffer << 6) | ALPHABET.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[j++] = (buffer >> bits) & 0xff;
    }
  }
  let text: string | null;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = null;
  }
  return { bytes, text, urlSafe };
}

/** Hex dump preview of binary data (offset, hex, ASCII). */
export function hexDump(bytes: Uint8Array, maxBytes = 512): string {
  const lines: string[] = [];
  const end = Math.min(bytes.length, maxBytes);
  for (let off = 0; off < end; off += 16) {
    const row = bytes.slice(off, Math.min(off + 16, end));
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(row, (b) =>
      b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.',
    ).join('');
    lines.push(`${off.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`);
  }
  if (bytes.length > maxBytes) lines.push(`… ${bytes.length - maxBytes} more bytes`);
  return lines.join('\n');
}

/** Detects a common file type from magic bytes (for decoded binary previews). */
export function sniffBinaryType(bytes: Uint8Array): { mime: string; extension: string } | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', extension: 'png' };
  if (starts([0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', extension: 'jpg' };
  if (starts([0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif', extension: 'gif' };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp', extension: 'webp' };
  if (starts([0x25, 0x50, 0x44, 0x46])) return { mime: 'application/pdf', extension: 'pdf' };
  if (starts([0x50, 0x4b, 0x03, 0x04])) return { mime: 'application/zip', extension: 'zip' };
  if (starts([0x1f, 0x8b])) return { mime: 'application/gzip', extension: 'gz' };
  return null;
}
