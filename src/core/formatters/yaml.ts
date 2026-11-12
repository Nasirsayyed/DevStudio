import { Document, isMap, isSeq, parseAllDocuments, visit, type YAMLError } from 'yaml';
import { ParseError, ValidationError } from '../errors/AppError';
import { formatJson, type IndentOption } from '../json/format';
import { parseJsonOrThrow } from '../json/parse';
import { isForbiddenKey } from '../security/safeJsonParse';

/**
 * YAML formatting, validation and YAML ⇄ JSON. Uses the `yaml` package (YAML 1.2 core schema,
 * plus `<<` merge keys). Alias expansion is capped to stop "billion laughs" documents.
 */

export interface YamlFormatOptions {
  indent: 2 | 4;
  /** Wrap long plain/quoted scalars at this width (0 = never). */
  lineWidth: number;
  sortKeys: boolean;
  /** Indent sequences inside mappings ("key:\n  - a") or not ("key:\n- a"). */
  indentSequences: boolean;
  quote: 'auto' | 'single' | 'double';
}

export const DEFAULT_YAML_FORMAT: YamlFormatOptions = {
  indent: 2,
  lineWidth: 0,
  sortKeys: false,
  indentSequences: true,
  quote: 'auto',
};

export interface YamlResult {
  text: string;
  documents: number;
  warnings: string[];
}

const MAX_ALIAS_COUNT = 100;

function toParseError(error: YAMLError): ParseError {
  const pos = error.linePos?.[0];
  const message = error.message.split('\n')[0] ?? 'Invalid YAML';
  return new ParseError(message, pos ? { line: pos.line, column: pos.col } : {}, error);
}

function parseDocs(text: string) {
  if (!text.trim()) throw new ValidationError('The YAML input is empty.');
  const docs = parseAllDocuments(text, { merge: true, prettyErrors: true, uniqueKeys: true });
  if (!Array.isArray(docs)) throw new ValidationError('Could not parse the YAML input.');
  for (const doc of docs) {
    const first = doc.errors[0];
    if (first) throw toParseError(first);
  }
  const warnings = docs.flatMap((d) => d.warnings.map((w) => w.message.split('\n')[0] ?? ''));
  return { docs, warnings };
}

function toStringOptions(o: YamlFormatOptions) {
  return {
    indent: o.indent,
    lineWidth: o.lineWidth,
    minContentWidth: 0,
    indentSeq: o.indentSequences,
    singleQuote: o.quote === 'auto' ? null : o.quote === 'single',
  } as const;
}

function sortDocument(doc: Document.Parsed | Document) {
  visit(doc, {
    Map(_, map) {
      map.items.sort((a, b) =>
        String(a.key).localeCompare(String(b.key), undefined, { numeric: true }),
      );
    },
  });
}

/** Reformats YAML; comments, anchors and document markers are kept. */
export function formatYaml(text: string, options: Partial<YamlFormatOptions> = {}): YamlResult {
  const o = { ...DEFAULT_YAML_FORMAT, ...options };
  const { docs, warnings } = parseDocs(text);
  const out = docs.map((doc) => {
    if (o.sortKeys) sortDocument(doc);
    return doc.toString(toStringOptions(o));
  });
  const joined =
    docs.length > 1
      ? out
          .map((d, i) => (i === 0 && !/^---/.test(d) ? d : d.startsWith('---') ? d : `---\n${d}`))
          .join('')
      : out.join('');
  return { text: joined, documents: docs.length, warnings };
}

/** Plain JS value of a document, with special keys dropped (prototype-pollution safe). */
function toPlain(doc: Document.Parsed, warnings: string[]): unknown {
  const value: unknown = doc.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
  const flags = { special: false };
  const clean = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(clean);
    if (v instanceof Map) {
      const o: Record<string, unknown> = {};
      for (const [k, val] of v) if (!isForbiddenKey(String(k))) o[String(k)] = clean(val);
      return o;
    }
    if (v instanceof Set) return [...v].map(clean);
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'number' && !Number.isFinite(v)) {
      flags.special = true;
      return null;
    }
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) if (!isForbiddenKey(k)) o[k] = clean(val);
      return o;
    }
    return v;
  };
  const result = clean(value);
  if (flags.special) warnings.push('.inf, -.inf and .nan have no JSON equivalent and became null.');
  return result;
}

export function yamlToJson(text: string, indent: IndentOption = 2): YamlResult {
  const { docs, warnings } = parseDocs(text);
  let value: unknown;
  try {
    const values = docs.map((d) => toPlain(d, warnings));
    value = values.length === 1 ? values[0] : values;
  } catch (error) {
    if (error instanceof ReferenceError || /alias/i.test(String(error)))
      throw new ValidationError(
        'The document uses too many aliases (possible "billion laughs" attack) and was not expanded.',
      );
    throw error;
  }
  if (docs.length > 1)
    warnings.push(`${docs.length} YAML documents were combined into a JSON array.`);
  return {
    text: formatJson((value ?? null) as Parameters<typeof formatJson>[0], indent),
    documents: docs.length,
    warnings,
  };
}

export function jsonToYaml(text: string, options: Partial<YamlFormatOptions> = {}): YamlResult {
  const o = { ...DEFAULT_YAML_FORMAT, ...options };
  const value = parseJsonOrThrow(text, 'JSON');
  const doc = new Document(value);
  if (o.sortKeys) sortDocument(doc);
  return { text: doc.toString(toStringOptions(o)), documents: 1, warnings: [] };
}

/** Number of top-level keys/items, for status display. */
export function yamlSummary(text: string): { documents: number; kind: string } {
  const { docs } = parseDocs(text);
  const first = docs[0]?.contents;
  return {
    documents: docs.length,
    kind: isMap(first) ? 'mapping' : isSeq(first) ? 'sequence' : 'scalar',
  };
}
