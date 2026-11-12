import { describe, expect, it } from 'vitest';
import { ParseError, ValidationError } from '../errors/AppError';
import { formatXml, minifyXml } from './xml';
import { formatYaml, jsonToYaml, yamlToJson } from './yaml';

const XML = `<?xml version="1.0"?><!DOCTYPE note><!-- top --><order id="1" status="paid"><customer><name>Ahmed</name><note/></customer><items><item sku="A">Keyboard</item><item sku="B"><![CDATA[<b>raw</b>]]></item></items><p>Hello <b>bold</b> text</p></order>`;

describe('XML formatter', () => {
  it('indents elements and keeps declarations, comments, CDATA and mixed content', () => {
    expect(formatXml(XML).text).toBe(`<?xml version="1.0"?>
<!DOCTYPE note>
<!-- top -->
<order id="1" status="paid">
  <customer>
    <name>Ahmed</name>
    <note/>
  </customer>
  <items>
    <item sku="A">Keyboard</item>
    <item sku="B"><![CDATA[<b>raw</b>]]></item>
  </items>
  <p>Hello <b>bold</b> text</p>
</order>
`);
  });

  it('supports tabs, 4 spaces, expanded empty elements and removing comments', () => {
    const out = formatXml('<a><!--x--><b></b></a>', {
      indent: 4,
      selfCloseEmpty: false,
      removeComments: true,
    }).text;
    expect(out).toBe('<a>\n    <b></b>\n</a>\n');
    expect(formatXml('<a><b/></a>', { indent: 'tab' }).text).toBe('<a>\n\t<b/>\n</a>\n');
  });

  it('wraps attributes when a tag is too long, or always', () => {
    const out = formatXml('<a one="1" two="2"/>', { attributesPerLine: 'always' }).text;
    expect(out).toBe('<a\n  one="1"\n  two="2"\n/>\n');
    expect(
      formatXml('<a one="1" two="2"/>', { attributesPerLine: 'auto', lineWidth: 10 }).text,
    ).toContain('\n  two="2"');
    expect(formatXml('<a one="1" two="2"/>').text).toBe('<a one="1" two="2"/>\n');
  });

  it('keeps whitespace inside xml:space="preserve" and ">" inside attribute values', () => {
    expect(formatXml('<r><pre xml:space="preserve">  a\n  b </pre></r>').text).toBe(
      '<r>\n  <pre xml:space="preserve">  a\n  b </pre>\n</r>\n',
    );
    expect(formatXml('<r><a x="1 > 0"/></r>').text).toBe('<r>\n  <a x="1 > 0"/>\n</r>\n');
  });

  it('minifies without touching text content', () => {
    expect(minifyXml('<a>\n  <b> x  y </b>\n  <!-- c -->\n</a>').text).toBe(
      '<a><b> x  y </b><!-- c --></a>',
    );
    expect(minifyXml('<a>\n  <!-- c -->\n</a>', { removeComments: true }).text).toBe('<a/>');
    expect(formatXml(minifyXml(XML).text).text).toBe(formatXml(XML).text);
  });

  it('reports malformed XML with a position', () => {
    expect(() => formatXml('')).toThrow(ValidationError);
    const error = (() => {
      try {
        formatXml('<a>\n  <b></a>');
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(ParseError);
    expect((error as ParseError).line).toBe(2);
    expect(() => formatXml('<a/><b/>')).toThrow(ParseError);
    expect(() => formatXml('<a x=1/>')).toThrow(ParseError);
  });

  it('counts elements, attributes and depth', () => {
    expect(formatXml(XML).stats).toEqual({ elements: 9, attributes: 4, maxDepth: 3 });
  });
});

describe('YAML', () => {
  const YAML = `# Service
name:   api
ports: [80, 443]
env:
    DEBUG: "false"   # keep as string
    LEVEL: info
`;

  it('reformats YAML and keeps comments', () => {
    expect(formatYaml(YAML).text).toBe(`# Service
name: api
ports: [ 80, 443 ]
env:
  DEBUG: "false" # keep as string
  LEVEL: info
`);
    expect(formatYaml('b: 1\na:\n  d: 1\n  c: 2\n', { sortKeys: true }).text).toBe(
      'a:\n  c: 2\n  d: 1\nb: 1\n',
    );
    expect(formatYaml('a:\n  - x\n', { indentSequences: false }).text).toBe('a:\n- x\n');
  });

  it('converts YAML to JSON, including anchors, merge keys and several documents', () => {
    expect(yamlToJson(YAML).text).toBe(
      '{\n  "name": "api",\n  "ports": [\n    80,\n    443\n  ],\n  "env": {\n    "DEBUG": "false",\n    "LEVEL": "info"\n  }\n}',
    );
    const merged = yamlToJson('base: &b {x: 1, y: 2}\nchild:\n  <<: *b\n  y: 3\n');
    expect(JSON.parse(merged.text)).toEqual({ base: { x: 1, y: 2 }, child: { x: 1, y: 3 } });
    const multi = yamlToJson('a: 1\n---\nb: 2\n');
    expect(JSON.parse(multi.text)).toEqual([{ a: 1 }, { b: 2 }]);
    expect(multi.warnings[0]).toMatch(/2 YAML documents/);
    expect(JSON.parse(yamlToJson('x: .inf').text)).toEqual({ x: null });
  });

  it('never pollutes prototypes', () => {
    const out = JSON.parse(
      yamlToJson('__proto__: {polluted: true}\nconstructor: 1\nok: 2').text,
    ) as object;
    expect(out).toEqual({ ok: 2 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('refuses "billion laughs" alias bombs', () => {
    const lines = ['a: &a ["x","x","x","x","x","x","x","x","x"]'];
    for (let i = 1; i < 8; i += 1) {
      const prev = String.fromCharCode(96 + i);
      const name = String.fromCharCode(97 + i);
      lines.push(`${name}: &${name} [${Array.from({ length: 9 }, () => `*${prev}`).join(',')}]`);
    }
    expect(() => yamlToJson(lines.join('\n'))).toThrow(/alias/i);
  });

  it('reports syntax errors with line and column, and duplicate keys', () => {
    const error = (() => {
      try {
        yamlToJson('a: 1\nb: [1, 2\nc: 3');
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(ParseError);
    expect((error as ParseError).line).toBeGreaterThan(1);
    expect(() => formatYaml('a: 1\na: 2')).toThrow(/unique|duplicate/i);
    expect(() => formatYaml('   ')).toThrow(ValidationError);
  });

  it('converts JSON to YAML and reports invalid JSON', () => {
    expect(jsonToYaml('{"name":"api","tags":["a","b"],"n":null}').text).toBe(
      'name: api\ntags:\n  - a\n  - b\nn: null\n',
    );
    expect(jsonToYaml('{"a":1}', { indent: 4 }).text).toBe('a: 1\n');
    expect(() => jsonToYaml('{bad}')).toThrow(ParseError);
  });
});
