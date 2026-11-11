import { isJsonObject, jsonTypeOf, setOwn } from './objects';
import type { JsonObject, JsonType, JsonValue } from './types';

export type SchemaDraftOption = '2020-12' | '2019-09' | '7';

export interface SchemaGeneratorOptions {
  draft?: SchemaDraftOption;
  title?: string;
  /** Mark properties present in every sample as required. */
  inferRequired?: boolean;
  /** Detect string formats (date-time, date, email, uri, uuid, ipv4). */
  detectFormats?: boolean;
  /** Set `additionalProperties: false` on objects. */
  strictObjects?: boolean;
}

const DRAFT_URIS: Record<SchemaDraftOption, string> = {
  '2020-12': 'https://json-schema.org/draft/2020-12/schema',
  '2019-09': 'https://json-schema.org/draft/2019-09/schema',
  '7': 'http://json-schema.org/draft-07/schema#',
};

const FORMATS: [string, RegExp][] = [
  ['date-time', /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/],
  ['date', /^\d{4}-\d{2}-\d{2}$/],
  ['uuid', /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/],
  ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/],
  ['uri', /^[a-zA-Z][a-zA-Z\d+.-]*:\/\/\S+$/],
  ['ipv4', /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/],
];

function detectFormat(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  return FORMATS.find(([, re]) => values.every((v) => re.test(v)))?.[0];
}

/** Infers a JSON Schema describing all provided sample values. */
function inferSchema(
  samples: JsonValue[],
  opts: Required<Omit<SchemaGeneratorOptions, 'title' | 'draft'>>,
): JsonObject {
  const byType = new Map<JsonType | 'integer', JsonValue[]>();
  for (const s of samples) {
    let t: JsonType | 'integer' = jsonTypeOf(s);
    if (t === 'number' && Number.isInteger(s)) t = 'integer';
    byType.set(t, [...(byType.get(t) ?? []), s]);
  }
  // integer + number → number
  if (byType.has('integer') && byType.has('number')) {
    byType.set('number', [...(byType.get('number') ?? []), ...(byType.get('integer') ?? [])]);
    byType.delete('integer');
  }
  const schemas: JsonObject[] = [];
  for (const [type, values] of byType) {
    if (type === 'null') continue;
    schemas.push(schemaForType(type, values, opts));
  }
  const nullable = byType.has('null');
  if (schemas.length === 0) return nullable ? { type: 'null' } : {};
  if (schemas.length === 1) {
    const only = schemas[0] as JsonObject;
    if (nullable) only.type = [only.type as string, 'null'];
    return only;
  }
  const anyOf: JsonValue[] = nullable ? [...schemas, { type: 'null' }] : schemas;
  return { anyOf };
}

function schemaForType(
  type: JsonType | 'integer',
  values: JsonValue[],
  opts: Required<Omit<SchemaGeneratorOptions, 'title' | 'draft'>>,
): JsonObject {
  if (type === 'object') {
    const objects = values.filter(isJsonObject);
    const keyOrder: string[] = [];
    const valuesByKey = new Map<string, JsonValue[]>();
    const counts = new Map<string, number>();
    for (const o of objects) {
      for (const k of Object.keys(o)) {
        if (!valuesByKey.has(k)) {
          keyOrder.push(k);
          valuesByKey.set(k, []);
        }
        valuesByKey.get(k)?.push(o[k] as JsonValue);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const properties: JsonObject = {};
    for (const k of keyOrder) setOwn(properties, k, inferSchema(valuesByKey.get(k) ?? [], opts));
    const schema: JsonObject = { type: 'object', properties };
    if (opts.inferRequired) {
      const required = keyOrder.filter((k) => counts.get(k) === objects.length);
      if (required.length) schema.required = required;
    }
    if (opts.strictObjects) schema.additionalProperties = false;
    return schema;
  }
  if (type === 'array') {
    const items: JsonValue[] = values.filter((v): v is JsonValue[] => Array.isArray(v)).flat();
    const schema: JsonObject = { type: 'array' };
    if (items.length > 0) schema.items = inferSchema(items, opts);
    return schema;
  }
  if (type === 'string' && opts.detectFormats) {
    const format = detectFormat(values as string[]);
    return format ? { type: 'string', format } : { type: 'string' };
  }
  return { type };
}

export function generateJsonSchema(
  value: JsonValue,
  options: SchemaGeneratorOptions = {},
): JsonObject {
  const {
    draft = '2020-12',
    title,
    inferRequired = true,
    detectFormats = true,
    strictObjects = false,
  } = options;
  const body = inferSchema([value], { inferRequired, detectFormats, strictObjects });
  return { $schema: DRAFT_URIS[draft], ...(title ? { title } : {}), ...body };
}
