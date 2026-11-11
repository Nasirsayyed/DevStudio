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
