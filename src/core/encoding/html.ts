import { decodeHTML, encodeHTML, encodeNonAsciiHTML, escapeUTF8 } from 'entities';

export type HtmlEncodeMode = 'minimal' | 'non-ascii' | 'all-named' | 'numeric';

/**
 * - minimal: only & < > " ' (safe for HTML text and attribute values)
 * - non-ascii: minimal + every non-ASCII character as an entity
 * - all-named: every character that has a named entity
 * - numeric: minimal + non-ASCII as &#x…; hexadecimal references
 */
export function encodeHtmlEntities(text: string, mode: HtmlEncodeMode): string {
  switch (mode) {
    case 'minimal':
      return escapeUTF8(text);
    case 'non-ascii':
      return encodeNonAsciiHTML(text);
    case 'all-named':
      return encodeHTML(text);
    case 'numeric':
      return Array.from(escapeUTF8(text), (ch) => {
        const cp = ch.codePointAt(0) ?? 0;
        return cp > 0x7e ? `&#x${cp.toString(16).toUpperCase()};` : ch;
      }).join('');
  }
}

/** Decodes every HTML5 named, decimal and hexadecimal character reference. */
export function decodeHtmlEntities(text: string): string {
  return decodeHTML(text);
}
