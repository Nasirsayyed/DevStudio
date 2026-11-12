import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import XMLBuilder from 'fast-xml-builder';
import { ParseError, ValidationError } from '../errors/AppError';
import { isJsonObject, setOwn } from '../json/objects';
import type { JsonObject, JsonValue } from '../json/types';

export interface XmlToJsonOptions {
  /** Prefix for attribute keys, e.g. "@" → { "@id": "1" }. */
  attributePrefix?: string;
  /** Key used for element text when an element also has attributes/children. */
  textKey?: string;
  /** Convert numeric and boolean text to numbers/booleans. */
  parseValues?: boolean;
  /** Always represent repeated-capable elements as arrays (consistent shapes). */
  alwaysArray?: boolean;
}

/**
 * Checks well-formedness (single root, matching tags, quoted attributes…) and throws a
 * `ParseError` with the line and column of the first problem.
 */
export function validateXmlSyntax(text: string): void {
  try {
    SyntaxValidator.validate(text, { allowBooleanAttributes: true, multipleRoots: false });
  } catch (error) {
    const e = error as { message?: string; line?: number; col?: number };
    const line = typeof e.line === 'number' ? e.line : undefined;
    const column = typeof e.col === 'number' ? e.col : undefined;
    const where = line !== undefined ? ` (line ${line}, column ${column ?? 1})` : '';
    throw new ParseError(
      `${e.message ?? 'Invalid XML'}${where}`,
      { ...(line !== undefined ? { line } : {}), ...(column !== undefined ? { column } : {}) },
      error,
    );
  }
}

/**
 * Converts XML to JSON. DTD entity declarations are rejected up front and
 * entity expansion is bounded, preventing "billion laughs" style attacks; no
 * external entities or resources are ever resolved.
 */
export function xmlToJson(text: string, options: XmlToJsonOptions = {}): JsonValue {
  const {
    attributePrefix = '@',
    textKey = '#text',
    parseValues = true,
    alwaysArray = false,
  } = options;
  if (!text.trim()) throw new ValidationError('The XML input is empty.');
  if (/<!ENTITY/i.test(text)) {
    throw new ValidationError(
      'XML entity declarations (<!ENTITY …>) are not supported, for security reasons.',
    );
  }
  validateXmlSyntax(text);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: attributePrefix,
    textNodeName: textKey,
    parseTagValue: parseValues,
    parseAttributeValue: parseValues,
    trimValues: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
    allowBooleanAttributes: true,
    processEntities: {
      enabled: true,
      maxEntityCount: 0,
      maxTotalExpansions: 10_000,
      maxExpandedLength: 1_000_000,
    },
    ...(alwaysArray
      ? {
          isArray: (_name: string, _path: unknown, _isLeaf: boolean, isAttribute: boolean) =>
            !isAttribute,
        }
      : {}),
  });
  const result = parser.parse(text) as JsonValue;
  // The validator tolerates several top-level elements; well-formed XML has exactly one.
  if (isJsonObject(result) && Object.keys(result).filter((k) => !k.startsWith('?')).length > 1) {
    throw new ValidationError('An XML document must have exactly one root element.');
  }
  return result;
}

export interface JsonToXmlOptions {
  /** Root element used when the JSON doesn't have exactly one top-level key. */
  rootName?: string;
  /** Element name for items of a top-level array. */
  itemName?: string;
  attributePrefix?: string;
  textKey?: string;
  indent?: 2 | 4;
  declaration?: boolean;
}

export interface JsonToXmlResult {
  xml: string;
  /** Keys renamed because they are not valid XML element names. */
  renamed: { from: string; to: string }[];
}

const NAME_START = /^[A-Za-z_][A-Za-z0-9_.-]*(:[A-Za-z_][A-Za-z0-9_.-]*)?$/;

function sanitizeName(name: string): string {
  if (NAME_START.test(name) && !/^xml/i.test(name)) return name;
  let out = name.replace(/[^A-Za-z0-9_.-]/g, '_');
  if (!/^[A-Za-z_]/.test(out) || /^xml/i.test(out)) out = `_${out}`;
  return out || '_';
}

export function jsonToXml(value: JsonValue, options: JsonToXmlOptions = {}): JsonToXmlResult {
  const {
    rootName = 'root',
    itemName = 'item',
    attributePrefix = '@',
    textKey = '#text',
    indent = 2,
    declaration = true,
  } = options;
  const renamed = new Map<string, string>();
  const safeRoot = sanitizeName(rootName);

  const clean = (v: JsonValue): JsonValue => {
    if (Array.isArray(v)) return v.map(clean);
    if (!isJsonObject(v)) return v;
    const out: JsonObject = {};
    for (const key of Object.keys(v)) {
      let name = key;
      if (key !== textKey) {
        const isAttr = attributePrefix !== '' && key.startsWith(attributePrefix);
        const bare = isAttr ? key.slice(attributePrefix.length) : key;
        const safe = sanitizeName(bare);
        if (safe !== bare) renamed.set(key, isAttr ? attributePrefix + safe : safe);
        name = isAttr ? attributePrefix + safe : safe;
      }
      setOwn(out, name, clean(v[key] as JsonValue));
    }
    return out;
  };

  let doc: JsonObject;
  const cleaned = clean(value);
  if (
    isJsonObject(cleaned) &&
    Object.keys(cleaned).length === 1 &&
    !Array.isArray(Object.values(cleaned)[0]) &&
    !(Object.keys(cleaned)[0] ?? '').startsWith(attributePrefix)
  ) {
    doc = cleaned;
  } else if (Array.isArray(cleaned)) {
    doc = { [safeRoot]: { [sanitizeName(itemName)]: cleaned } };
  } else {
    doc = { [safeRoot]: cleaned };
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: attributePrefix,
    textNodeName: textKey,
    format: true,
    indentBy: ' '.repeat(indent),
    suppressEmptyNode: false,
    suppressBooleanAttributes: false,
    processEntities: true,
  });
  const body = builder.build(doc).trim();
  const xml = `${declaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : ''}${body}\n`;
  return { xml, renamed: [...renamed.entries()].map(([from, to]) => ({ from, to })) };
}
