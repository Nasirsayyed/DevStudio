import mime from 'mime';
import otherTypes from 'mime/types/other.js';
import standardTypes from 'mime/types/standard.js';

export interface MimeEntry {
  type: string;
  extensions: string[];
  /** Registered with IANA (standard) vs. vendor/experimental (other). */
  standard: boolean;
}

let cache: MimeEntry[] | null = null;

/** Every known MIME type with its extensions (≈ 1,000 entries). */
export function allMimeTypes(): MimeEntry[] {
  cache ??= [
    ...Object.entries(standardTypes).map(([type, extensions]) => ({
      type,
      extensions: [...extensions],
      standard: true,
    })),
    ...Object.entries(otherTypes).map(([type, extensions]) => ({
      type,
      extensions: [...extensions],
      standard: false,
    })),
  ].sort((a, b) => a.type.localeCompare(b.type));
  return cache;
}

/** Searches by extension (".png", "png"), file name ("report.pdf"), type ("image/") or keyword. */
export function searchMimeTypes(query: string, limit = 200): MimeEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return allMimeTypes().slice(0, limit);
  const ext = q.replace(/^.*\./, '');
  const exact = q.includes('/') ? null : mime.getType(q);
  const results = allMimeTypes().filter(
    (e) => e.type.includes(q) || e.extensions.some((x) => x === ext || x.startsWith(ext)),
  );
  // Put the canonical match for an extension/file name first.
  results.sort(
    (a, b) =>
      Number(b.type === exact) - Number(a.type === exact) ||
      Number(b.extensions.includes(ext)) - Number(a.extensions.includes(ext)),
  );
  return results.slice(0, limit);
}

export function mimeForFileName(name: string): string | null {
  return mime.getType(name);
}

export function extensionsForType(type: string): string[] {
  return [...(mime.getAllExtensions(type) ?? [])];
}
