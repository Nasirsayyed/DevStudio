import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { csvToJson, jsonToCsv } from './csv';
import { SAMPLE_ORDER_JSON, SAMPLE_SCHEMA_JSON, SAMPLE_USERS_CSV } from './samples';
import { generateJsonSchema } from './schemaGenerator';
import { detectDraft, validateJsonSchema } from './schemaValidator';
import type { JsonValue } from './types';

const order = JSON.parse(SAMPLE_ORDER_JSON) as JsonValue;

describe('generateJsonSchema', () => {
  it('infers types, required properties, formats and nested items', () => {
    const schema = generateJsonSchema(order) as Record<string, any>;
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.type).toBe('object');
    expect(schema.properties.order_id).toEqual({ type: 'integer' });
    expect(schema.properties.total_amount).toEqual({ type: 'number' });
    expect(schema.properties.email).toEqual({ type: 'string', format: 'email' });
    expect(schema.properties.created_at).toEqual({ type: 'string', format: 'date-time' });
    expect(schema.properties.coupon).toEqual({ type: 'null' });
    expect(schema.properties.items.items.properties.unit_price).toEqual({ type: 'number' });
    expect(schema.properties.items.items.required).toEqual([
      'sku',
      'name',
      'quantity',
      'unit_price',
      'tags',
    ]);
    expect(schema.required).toContain('shipping_address');
  });

  it('marks properties missing from some samples as optional and merges nullable types', () => {
    const schema = generateJsonSchema([{ a: 1, b: 'x' }, { a: null }, { a: 2 }]) as Record<
      string,
      any
    >;
    expect(schema.items.properties.a).toEqual({ type: ['integer', 'null'] });
    expect(schema.items.required).toEqual(['a']);
  });

  it('uses anyOf for mixed types and supports options', () => {
    const schema = generateJsonSchema([1, 'x'], {
      draft: '7',
      title: 'Mixed',
      inferRequired: false,
    }) as Record<string, any>;
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.title).toBe('Mixed');
    expect(schema.items.anyOf).toEqual([{ type: 'integer' }, { type: 'string' }]);
    expect(
      (generateJsonSchema({ a: 1 }, { strictObjects: true }) as Record<string, any>)
        .additionalProperties,
    ).toBe(false);
  });

  it('generated schemas validate their own sample', () => {
    const schema = generateJsonSchema(order);
    expect(validateJsonSchema(order, schema).valid).toBe(true);
  });
});

describe('validateJsonSchema', () => {
  const schema = JSON.parse(SAMPLE_SCHEMA_JSON) as JsonValue;

  it('accepts valid data', () => {
    const r = validateJsonSchema(order, schema);
    expect(r).toMatchObject({ valid: true, draft: '2020-12', errors: [] });
  });

  it('reports specific errors with instance locations', () => {
    const bad = {
      order_id: 0,
      customer_name: '',
      total_amount: -1,
      items: [{ sku: 'bad', quantity: 0 }],
    };
    const r = validateJsonSchema(bad, schema);
    expect(r.valid).toBe(false);
    const locations = r.errors.map((e) => `${e.instanceLocation}:${e.keyword}`);
    expect(locations).toEqual(
      expect.arrayContaining([
        '/order_id:minimum',
        '/customer_name:minLength',
        '/total_amount:minimum',
        '/items/0/sku:pattern',
        '/items/0/quantity:minimum',
      ]),
    );
    expect(locations.some((l) => l.endsWith(':properties'))).toBe(false);
  });

  it('reports missing required properties', () => {
    const r = validateJsonSchema({}, schema);
    expect(r.errors.some((e) => e.keyword === 'required')).toBe(true);
  });

  it('detects drafts and rejects non-schema values', () => {
    expect(detectDraft({ $schema: 'http://json-schema.org/draft-07/schema#' })).toBe('7');
    expect(detectDraft({ $schema: 'http://json-schema.org/draft-04/schema#' })).toBe('4');
    expect(detectDraft({})).toBe('2020-12');
    expect(() => validateJsonSchema({}, [1])).toThrow(ValidationError);
    expect(validateJsonSchema(1, false).valid).toBe(false);
    expect(validateJsonSchema(1, true).valid).toBe(true);
  });
});

describe('jsonToCsv', () => {
  it('flattens nested objects into columns and keeps arrays as JSON', () => {
    const r = jsonToCsv([
      { id: 1, user: { name: 'A' }, tags: ['x', 'y'] },
      { id: 2, user: { name: 'B, Jr.' }, extra: null },
    ]);
    expect(r.columns).toEqual(['id', 'user.name', 'tags', 'extra']);
    expect(r.csv).toBe('id,user.name,tags,extra\r\n1,A,"[""x"",""y""]",\r\n2,"B, Jr.",,');
  });

  it('expands arrays, supports delimiters and single objects', () => {
    expect(jsonToCsv({ a: [1, 2] }, { arrays: 'expand' }).columns).toEqual(['a.0', 'a.1']);
    expect(jsonToCsv([{ a: 1, b: 2 }], { delimiter: ';', newline: '\n' }).csv).toBe('a;b\n1;2');
    expect(jsonToCsv([1, 'two']).csv).toBe('value\r\n1\r\ntwo');
    expect(jsonToCsv([{ a: 1 }], { header: false }).csv).toBe('1');
  });

  it('neutralizes spreadsheet formula injection by default', () => {
    expect(jsonToCsv([{ f: '=HYPERLINK("http://evil")' }]).csv).toContain(
      `"'=HYPERLINK(""http://evil"")"`,
    );
    expect(jsonToCsv([{ f: '=1+1' }], { escapeFormulae: false }).csv).toBe('f\r\n=1+1');
  });

  it('rejects primitives at the root', () => {
    expect(() => jsonToCsv(5)).toThrow(ValidationError);
  });
});

describe('csvToJson', () => {
  it('parses headers, quoted fields and dynamic types', () => {
    const r = csvToJson(SAMPLE_USERS_CSV);
    expect(r.fields).toEqual([
      'id',
      'name',
      'email',
      'address.city',
      'address.country',
      'active',
      'score',
    ]);
    expect(r.value[2]).toEqual({
      id: 3,
      name: 'Chen, Wei',
      email: 'chen@example.com',
      'address.city': 'Shanghai',
      'address.country': 'CN',
      active: false,
      score: null,
    });
    expect(r.delimiter).toBe(',');
  });

  it('nests dotted headers and auto-detects delimiters', () => {
    const r = csvToJson('id;address.city\n1;Paris', { nest: true });
    expect(r.value).toEqual([{ id: 1, address: { city: 'Paris' } }]);
    expect(r.delimiter).toBe(';');
  });

  it('keeps strings when dynamic typing is off and supports headerless input', () => {
    expect(csvToJson('code\n007', { dynamicTyping: false }).value).toEqual([{ code: '007' }]);
    expect(csvToJson('a,b\n1,2', { header: false }).value).toEqual([
      ['a', 'b'],
      [1, 2],
    ]);
  });

  it('reports malformed rows and rejects empty input', () => {
    const r = csvToJson('a,b\n1,2\n3');
    const mismatch = r.issues.find((i) => i.message.startsWith('Too few fields'));
    expect(mismatch?.row).toBe(3);
    expect(() => csvToJson('   ')).toThrow(ValidationError);
  });

  it('round-trips with jsonToCsv', () => {
    const data = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B "quoted"' },
    ];
    expect(csvToJson(jsonToCsv(data).csv).value).toEqual(data);
  });
});
