import { describe, expect, it } from 'vitest';
import { ParseError, ValidationError } from '../errors/AppError';
import { jsonToXml, xmlToJson } from './xml';

describe('xmlToJson', () => {
  it('converts elements, attributes, repeated elements and typed values', () => {
    expect(
      xmlToJson(
        '<?xml version="1.0"?><order id="7" paid="true"><item sku="A">Keyboard</item><item sku="B">Mouse</item><total>12.50</total><note/></order>',
      ),
    ).toEqual({
      order: {
        item: [
          { '#text': 'Keyboard', '@sku': 'A' },
          { '#text': 'Mouse', '@sku': 'B' },
        ],
        total: 12.5,
        note: '',
        '@id': 7,
        '@paid': true,
      },
    });
  });

  it('can keep strings, use custom prefixes and force arrays', () => {
    expect(
      xmlToJson('<a x="1"><b>007</b></a>', { parseValues: false, attributePrefix: '_' }),
    ).toEqual({ a: { b: '007', _x: '1' } });
    expect(xmlToJson('<a><b>1</b></a>', { alwaysArray: true })).toEqual({ a: [{ b: [1] }] });
  });

  it('reports syntax errors with positions', () => {
    try {
      xmlToJson('<a>\n<b></a>');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).line).toBe(2);
      expect((e as ParseError).message).toMatch(/Expected closing tag 'b'/);
    }
  });

  it('rejects empty input, multiple roots and entity declarations (billion laughs)', () => {
    expect(() => xmlToJson('  ')).toThrow(ValidationError);
    expect(() => xmlToJson('<a/><b/>')).toThrow(/root/i);
    const bomb =
      '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><lolz>&lol2;</lolz>';
    expect(() => xmlToJson(bomb)).toThrow(/entity declarations/);
  });

  it('decodes predefined entities', () => {
    expect(xmlToJson('<a>x &amp; y &lt; z</a>')).toEqual({ a: 'x & y < z' });
  });
});

describe('jsonToXml', () => {
  it('uses a single top-level key as the root and escapes text', () => {
    const r = jsonToXml({
      order: { '@id': 7, items: [{ sku: 'A' }, { sku: 'B' }], text: 'a < b & c', none: null },
    });
    expect(r.xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<order id="7">\n  <items>\n    <sku>A</sku>\n  </items>\n  <items>\n    <sku>B</sku>\n  </items>\n  <text>a &lt; b &amp; c</text>\n  <none/>\n</order>\n',
    );
  });

  it('wraps arrays and multi-key objects, renames invalid element names', () => {
    expect(jsonToXml([1, 2], { declaration: false, itemName: 'n' }).xml).toBe(
      '<root>\n  <n>1</n>\n  <n>2</n>\n</root>\n',
    );
    const r = jsonToXml(
      { 'first name': 'x', '1st': true, xmlData: 1 },
      { rootName: 'data', declaration: false },
    );
    expect(r.xml).toContain(
      '<data>\n  <first_name>x</first_name>\n  <_1st>true</_1st>\n  <_xmlData>1</_xmlData>\n</data>',
    );
    expect(r.renamed).toEqual([
      { from: 'first name', to: 'first_name' },
      { from: '1st', to: '_1st' },
      { from: 'xmlData', to: '_xmlData' },
    ]);
  });

  it('round-trips through xmlToJson', () => {
    const value = {
      catalog: {
        book: [
          { '@id': 1, title: 'A' },
          { '@id': 2, title: 'B' },
        ],
      },
    };
    expect(xmlToJson(jsonToXml(value).xml)).toEqual(value);
  });
});
