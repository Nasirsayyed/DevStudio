import { ValidationError } from '@/core/errors/AppError';
import { formatBytes } from '@/core/format/bytes';
import { saveAs } from 'file-saver';
import {
  type FileRules,
  normalizeTextContent,
  validateFileMeta,
} from '@/core/files/fileValidation';

/** Validates and reads a user-supplied text file (UTF-8). */
export async function readTextFile(file: File, rules: FileRules): Promise<string> {
  validateFileMeta(file, rules);
  const text = await file.text();
  return normalizeTextContent(file.name, text);
}

/** Saves text as a file download. Nothing leaves the browser. */
export function downloadText(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  saveAs(blob, filename, { autoBom: false });
}

/** Reads a file as bytes after checking its size. */
export async function readFileBytes(file: File, maxBytes: number): Promise<Uint8Array> {
  if (file.size > maxBytes)
    throw new ValidationError(
      `"${file.name}" is ${formatBytes(file.size)}; the limit is ${formatBytes(maxBytes)}.`,
    );
  return new Uint8Array(await file.arrayBuffer());
}

/** Downloads raw bytes as a file. */
export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType = 'application/octet-stream',
): void {
  saveAs(new Blob([new Uint8Array(bytes)], { type: mimeType }), filename, { autoBom: false });
}
