import { ValidationError } from '../errors/AppError';

export type UrlEncodeMode = 'component' | 'uri' | 'form';

/**
 * - component: encodeURIComponent (for a single query value or path segment)
 * - uri: encodeURI (keeps :/?#&= so a full URL stays usable)
 * - form: application/x-www-form-urlencoded (spaces become +)
 */
export function encodeUrl(text: string, mode: UrlEncodeMode): string {
  try {
    if (mode === 'uri') return encodeURI(text);
    const encoded = encodeURIComponent(text).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return mode === 'form' ? encoded.replace(/%20/g, '+') : encoded;
  } catch {
    // Lone surrogates cannot be encoded as UTF-8.
    throw new ValidationError(
      'The text contains an invalid Unicode character (unpaired surrogate).',
    );
  }
}

/** Decodes percent-encoding; reports the first malformed escape. */
export function decodeUrl(text: string, plusAsSpace: boolean): string {
  const input = plusAsSpace ? text.replace(/\+/g, ' ') : text;
  try {
    return decodeURIComponent(input);
  } catch {
    const bad = /%(?![0-9A-Fa-f]{2})/.exec(input);
    if (bad)
      throw new ValidationError(
        `Malformed percent-encoding "${input.slice(bad.index, bad.index + 3)}" at position ${bad.index + 1}.`,
      );
    throw new ValidationError('The percent-encoded bytes are not valid UTF-8.');
  }
}

export interface ParsedUrl {
  href: string;
  protocol: string;
  username: string;
  hasPassword: boolean;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  params: { key: string; value: string }[];
}

/** Splits a URL into components and decoded query parameters (repeated keys kept). */
export function parseUrl(text: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    throw new ValidationError('Not an absolute URL (include the scheme, e.g. https://).');
  }
  return {
    href: url.href,
    protocol: url.protocol,
    username: decodeURIComponent(url.username),
    hasPassword: url.password !== '',
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    params: [...url.searchParams.entries()].map(([key, value]) => ({ key, value })),
  };
}
