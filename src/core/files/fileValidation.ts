import { ValidationError } from '../errors/AppError';
import { formatBytes } from '../format/bytes';

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export interface FileRules {
  /** Lowercase extensions including the dot, e.g. [".json", ".txt"]. Empty = any. */
  extensions: readonly string[];
  maxBytes: number;
}

export const JSON_FILE_RULES: FileRules = {
  extensions: ['.json', '.txt', '.geojson', '.har', '.map'],
  maxBytes: 50 * 1024 * 1024,
};
export const XML_FILE_RULES: FileRules = {
  extensions: [
    '.xml',
    '.txt',
    '.svg',
    '.rss',
    '.atom',
    '.xsd',
    '.wsdl',
    '.config',
    '.csproj',
    '.xaml',
    '.plist',
  ],
  maxBytes: 50 * 1024 * 1024,
};
export const CSV_FILE_RULES: FileRules = {
  extensions: ['.csv', '.tsv', '.txt'],
  maxBytes: 50 * 1024 * 1024,
};

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i).toLowerCase() : '';
}

/** Validates a file's metadata before reading it. Throws ValidationError. */
export function validateFileMeta(file: FileLike, rules: FileRules): void {
  if (file.size === 0) throw new ValidationError(`"${file.name}" is empty.`);
  if (file.size > rules.maxBytes) {
    throw new ValidationError(
      `"${file.name}" is ${formatBytes(file.size)}; the limit is ${formatBytes(rules.maxBytes)}.`,
    );
  }
  if (rules.extensions.length > 0 && !rules.extensions.includes(fileExtension(file.name))) {
    throw new ValidationError(
      `"${file.name}" is not a supported file type (${rules.extensions.join(', ')}).`,
    );
  }
}

/** Rejects binary content (NUL bytes) and strips a UTF-8 BOM. */
export function normalizeTextContent(name: string, text: string): string {
  if (text.slice(0, 8192).includes('\u0000'))
    throw new ValidationError(`"${name}" looks like a binary file, not text.`);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
