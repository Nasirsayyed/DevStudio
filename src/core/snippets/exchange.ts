import { z } from 'zod';
import type { CodeSnippetEntity } from '@/types/entities';
import { ParseError, ValidationError } from '../errors/AppError';
import { extensionForLanguage, normalizeLanguage } from '../languages/languages';
import { safeJsonParse } from '../security/safeJsonParse';
import { prepareSnippet, type SnippetDraft } from './model';

/**
 * Snippet import and export. Two formats are understood:
 * - DevStudio snippet files (`{ "format": "devstudio-snippets", "version": 1, "snippets": [...] }`),
 *   or a bare array of snippets;
 * - VS Code snippet files (`*.code-snippets` / `<language>.json`: `{ "Name": { "prefix", "body" } }`).
 * Every item is validated on its own: invalid items are reported and skipped, never imported.
 */

export const SNIPPET_FILE_FORMAT = 'devstudio-snippets';
export const SNIPPET_FILE_VERSION = 1;
export const MAX_IMPORT_SNIPPETS = 10_000;

export interface ImportItem extends SnippetDraft {
  /** Kept from DevStudio files so a re-import can recognise the same snippet. */
  id?: string;
  isFavorite: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface ParsedImport {
  format: 'devstudio' | 'vscode';
  items: ImportItem[];
  /** "Snippet 3 (“Foo”): Give the snippet a title." */
  errors: string[];
}

const timestamp = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const ms = typeof v === 'number' ? v : Date.parse(v);
    return Number.isFinite(ms) && ms > 0 ? ms : undefined;
  });

const devstudioItem = z.object({
  id: z.string().max(64).optional(),
  title: z.string(),
  description: z.string().optional().default(''),
  code: z.string(),
  language: z.string().optional().default('plaintext'),
  category: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  isFavorite: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .optional()
    .default(false),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const vscodeItem = z.object({
  prefix: z.union([z.string(), z.array(z.string())]).optional(),
  body: z.union([z.string(), z.array(z.string())]),
  description: z.union([z.string(), z.array(z.string())]).optional(),
  scope: z.string().optional(),
});

const label = (i: number, title: unknown) =>
  `Snippet ${String(i + 1)}${typeof title === 'string' && title.trim() ? ` (“${title.trim().slice(0, 40)}”)` : ''}`;

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid snippet.';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

function finish(item: Omit<ImportItem, keyof SnippetDraft> & SnippetDraft): ImportItem {
  return { ...item, ...prepareSnippet(item) };
}

function parseDevstudio(list: unknown[], errors: string[]): ImportItem[] {
  const items: ImportItem[] = [];
  list.forEach((raw, i) => {
    const parsed = devstudioItem.safeParse(raw);
    const title = (raw as { title?: unknown } | null)?.title;
    if (!parsed.success) {
      errors.push(`${label(i, title)}: ${firstIssue(parsed.error)}`);
      return;
    }
    const v = parsed.data;
    try {
      items.push(
        finish({
          ...(v.id ? { id: v.id } : {}),
          ...(v.createdAt ? { createdAt: v.createdAt } : {}),
          ...(v.updatedAt ? { updatedAt: v.updatedAt } : {}),
          title: v.title,
          description: v.description,
          code: v.code,
          language: v.language,
          category: v.category,
          tags: v.tags,
          isFavorite: v.isFavorite === true || v.isFavorite === 1,
        }),
      );
    } catch (error) {
      errors.push(
        `${label(i, title)}: ${error instanceof Error ? error.message : 'Invalid snippet.'}`,
      );
    }
  });
  return items;
}

function parseVscode(
  entries: [string, unknown][],
  errors: string[],
  fallbackLanguage: string,
): ImportItem[] {
  const items: ImportItem[] = [];
  entries.forEach(([name, raw], i) => {
    const parsed = vscodeItem.safeParse(raw);
    if (!parsed.success) {
      errors.push(`${label(i, name)}: ${firstIssue(parsed.error)}`);
      return;
    }
    const v = parsed.data;
    const prefixes = v.prefix === undefined ? [] : Array.isArray(v.prefix) ? v.prefix : [v.prefix];
    const scope = v.scope?.split(',')[0];
    try {
      items.push(
        finish({
          title: name,
          description: Array.isArray(v.description)
            ? v.description.join('\n')
            : (v.description ?? ''),
          code: Array.isArray(v.body) ? v.body.join('\n') : v.body,
          language: scope ? normalizeLanguage(scope) : fallbackLanguage,
          category: 'VS Code',
          tags: prefixes.map((p) => `prefix:${p}`),
          isFavorite: false,
        }),
      );
    } catch (error) {
      errors.push(
        `${label(i, name)}: ${error instanceof Error ? error.message : 'Invalid snippet.'}`,
      );
    }
  });
  return items;
}

function isVscodeMap(value: Record<string, unknown>): boolean {
  const values = Object.values(value);
  return (
    values.length > 0 &&
    values.every((v) => v !== null && typeof v === 'object' && !Array.isArray(v) && 'body' in v)
  );
}

/**
 * Parses an import file. `fileName` lets VS Code language files (`python.json`) set the language
 * of snippets that have no `scope`.
 */
export function parseSnippetFile(text: string, fileName = ''): ParsedImport {
  if (!text.trim()) throw new ValidationError('The file is empty.');
  let data: unknown;
  try {
    // VS Code snippet files may contain comments and trailing commas (JSONC).
    data = safeJsonParse(text);
  } catch (error) {
    try {
      data = safeJsonParse(stripJsonComments(text));
    } catch {
      throw new ParseError(
        `This is not a valid snippet file: ${error instanceof Error ? error.message : 'invalid JSON'}.`,
      );
    }
  }
  const errors: string[] = [];
  let format: ParsedImport['format'];
  let items: ImportItem[];
  const count = (n: number) => {
    if (n > MAX_IMPORT_SNIPPETS)
      throw new ValidationError(
        `The file has ${n.toLocaleString('en-US')} snippets; at most ${MAX_IMPORT_SNIPPETS.toLocaleString('en-US')} can be imported at once.`,
      );
  };
  if (Array.isArray(data)) {
    count(data.length);
    format = 'devstudio';
    items = parseDevstudio(data, errors);
  } else if (data !== null && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (obj.format === SNIPPET_FILE_FORMAT) {
      if (typeof obj.version === 'number' && obj.version > SNIPPET_FILE_VERSION)
        throw new ValidationError(
          `This file was made by a newer DevStudio (format version ${String(obj.version)}).`,
        );
      if (!Array.isArray(obj.snippets))
        throw new ValidationError('The file has no "snippets" list.');
      count(obj.snippets.length);
      format = 'devstudio';
      items = parseDevstudio(obj.snippets, errors);
    } else if (isVscodeMap(obj)) {
      const entries = Object.entries(obj);
      count(entries.length);
      format = 'vscode';
      const base = fileName.replace(/^.*[\\/]/, '').replace(/\.(code-snippets|json)$/i, '');
      items = parseVscode(entries, errors, normalizeLanguage(base));
    } else {
      throw new ValidationError(
        'Unrecognised file. Import a DevStudio snippet export or a VS Code snippets file.',
      );
    }
  } else {
    throw new ValidationError(
      'Unrecognised file. Import a DevStudio snippet export or a VS Code snippets file.',
    );
  }
  return { format, items, errors };
}

/** Removes // and /* *\/ comments and trailing commas outside strings (JSONC → JSON). */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] ?? '';
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 1;
      } else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export type DuplicateStrategy = 'skip' | 'replace' | 'copy';

export interface ImportPlan {
  add: ImportItem[];
  update: { id: string; item: ImportItem }[];
  skipped: number;
}

const sameContent = (a: { title: string; code: string }, b: { title: string; code: string }) =>
  a.title.toLocaleLowerCase() === b.title.toLocaleLowerCase() && a.code === b.code;

/** Decides what an import does with snippets that already exist (same id, or same title and code). */
export function planImport(
  existing: readonly Pick<CodeSnippetEntity, 'id' | 'title' | 'code'>[],
  items: readonly ImportItem[],
  strategy: DuplicateStrategy,
): ImportPlan {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const titles = new Set(existing.map((s) => s.title.toLocaleLowerCase()));
  const plan: ImportPlan = { add: [], update: [], skipped: 0 };
  const seenIds = new Set<string>();
  for (const item of items) {
    const match =
      (item.id !== undefined ? byId.get(item.id) : undefined) ??
      existing.find((s) => sameContent(s, item));
    if (!match) {
      // Keep the original id only once (a file could repeat it).
      const keepId = item.id !== undefined && !seenIds.has(item.id);
      if (item.id !== undefined) seenIds.add(item.id);
      const { id: _drop, ...rest } = item;
      plan.add.push(keepId ? item : rest);
      titles.add(item.title.toLocaleLowerCase());
      continue;
    }
    if (strategy === 'skip') plan.skipped += 1;
    else if (strategy === 'replace') plan.update.push({ id: match.id, item });
    else {
      let title = `${item.title} (copy)`;
      for (let n = 2; titles.has(title.toLocaleLowerCase()); n += 1)
        title = `${item.title} (copy ${String(n)})`;
      titles.add(title.toLocaleLowerCase());
      const { id: _drop, ...rest } = item;
      plan.add.push({ ...rest, title: title.slice(0, 200) });
    }
  }
  return plan;
}

export function exportSnippets(snippets: readonly CodeSnippetEntity[], now = Date.now()): string {
  return `${JSON.stringify(
    {
      format: SNIPPET_FILE_FORMAT,
      version: SNIPPET_FILE_VERSION,
      exportedAt: new Date(now).toISOString(),
      snippets: snippets.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        code: s.code,
        language: s.language,
        category: s.category,
        tags: s.tags,
        isFavorite: s.isFavorite === 1,
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
      })),
    },
    null,
    2,
  )}\n`;
}

const VSCODE_SCOPE: Record<string, string> = { shell: 'shellscript', plaintext: '' };

/** VS Code `.code-snippets` file. A `prefix:<x>` tag becomes the prefix; otherwise the title in kebab-case. */
export function exportVscodeSnippets(snippets: readonly CodeSnippetEntity[]): string {
  const out: Record<
    string,
    { prefix: string | string[]; body: string[]; description?: string; scope?: string }
  > = {};
  for (const s of snippets) {
    let name = s.title;
    for (let n = 2; Object.prototype.hasOwnProperty.call(out, name); n += 1)
      name = `${s.title} (${String(n)})`;
    const prefixes = s.tags.filter((t) => t.startsWith('prefix:')).map((t) => t.slice(7));
    const fallback =
      s.title
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-|-$/g, '') || 'snippet';
    const scope = VSCODE_SCOPE[s.language] ?? s.language;
    out[name] = {
      prefix:
        prefixes.length === 1
          ? (prefixes[0] ?? fallback)
          : prefixes.length > 1
            ? prefixes
            : fallback,
      body: s.code.split(/\r\n|\r|\n/),
      ...(s.description ? { description: s.description } : {}),
      ...(scope ? { scope } : {}),
    };
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** "Debounce helper" → "debounce-helper.ts". */
export function snippetFileName(s: Pick<CodeSnippetEntity, 'title' | 'language'>): string {
  const base =
    s.title
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'snippet';
  const ext = extensionForLanguage(s.language);
  return s.language === 'dockerfile' ? 'Dockerfile' : `${base}.${ext}`;
}
