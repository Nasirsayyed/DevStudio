import { validateXmlSyntax } from '../converters/xml';
import { ValidationError } from '../errors/AppError';

/**
 * XML pretty-printer and minifier. Works on the token level, so comments, CDATA, processing
 * instructions and the DOCTYPE are kept verbatim; nothing is ever expanded or resolved.
 */

export interface XmlFormatOptions {
  indent: 2 | 4 | 'tab';
  /** Put each attribute on its own line: never, always, or when the tag is longer than lineWidth. */
  attributesPerLine: 'never' | 'always' | 'auto';
  lineWidth: number;
  /** Write empty elements as <a/> instead of <a></a>. */
  selfCloseEmpty: boolean;
  removeComments: boolean;
}

export const DEFAULT_XML_FORMAT: XmlFormatOptions = {
  indent: 2,
  attributesPerLine: 'auto',
  lineWidth: 100,
  selfCloseEmpty: true,
  removeComments: false,
};

type XmlNode =
  | { type: 'element'; name: string; attrs: string[]; children: XmlNode[]; preserve: boolean }
  | { type: 'text'; value: string }
  | { type: 'raw'; kind: 'comment' | 'cdata' | 'pi' | 'doctype'; value: string };

export interface XmlStats {
  elements: number;
  attributes: number;
  maxDepth: number;
}

function indexOrThrow(text: string, needle: string, from: number): number {
  const i = text.indexOf(needle, from);
  if (i === -1) throw new ValidationError(`Unterminated markup: expected "${needle}".`);
  return i;
}

/** Finds the end of a tag, skipping ">" inside quoted attribute values. */
function tagEnd(text: string, from: number, brackets = false): number {
  let quote: string | null = null;
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (brackets && c === '[') depth += 1;
    else if (brackets && c === ']') depth -= 1;
    else if (c === '>' && depth <= 0) return i;
  }
  throw new ValidationError('Unterminated tag.');
}

const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'))?/g;

function parseTree(text: string): { nodes: XmlNode[]; stats: XmlStats } {
  const root: XmlNode[] = [];
  const stack: Extract<XmlNode, { type: 'element' }>[] = [];
  const stats: XmlStats = { elements: 0, attributes: 0, maxDepth: 0 };
  const add = (n: XmlNode) => (stack.at(-1)?.children ?? root).push(n);
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '<') {
      const next = text.indexOf('<', i);
      const end = next === -1 ? text.length : next;
      add({ type: 'text', value: text.slice(i, end) });
      i = end;
      continue;
    }
    if (text.startsWith('<?', i)) {
      const end = indexOrThrow(text, '?>', i) + 2;
      add({ type: 'raw', kind: 'pi', value: text.slice(i, end) });
      i = end;
    } else if (text.startsWith('<!--', i)) {
      const end = indexOrThrow(text, '-->', i + 4) + 3;
      add({ type: 'raw', kind: 'comment', value: text.slice(i, end) });
      i = end;
    } else if (text.startsWith('<![CDATA[', i)) {
      const end = indexOrThrow(text, ']]>', i) + 3;
      add({ type: 'raw', kind: 'cdata', value: text.slice(i, end) });
      i = end;
    } else if (text.startsWith('<!', i)) {
      const end = tagEnd(text, i + 2, true) + 1;
      add({ type: 'raw', kind: 'doctype', value: text.slice(i, end) });
      i = end;
    } else if (text.startsWith('</', i)) {
      i = tagEnd(text, i + 2) + 1;
      stack.pop();
    } else {
      const end = tagEnd(text, i + 1);
      const selfClosing = text[end - 1] === '/';
      const body = text.slice(i + 1, selfClosing ? end - 1 : end);
      const name = /^[^\s/>]+/.exec(body)?.[0] ?? '';
      const attrs = Array.from(body.slice(name.length).matchAll(ATTR_RE), (m) =>
        m[2] === undefined ? (m[1] ?? '') : `${m[1] ?? ''}=${m[2]}`,
      );
      const parentPreserve = stack.at(-1)?.preserve ?? false;
      const space = attrs.find((a) => a.startsWith('xml:space='));
      const el: XmlNode = {
        type: 'element',
        name,
        attrs,
        children: [],
        preserve: space ? /preserve/.test(space) : parentPreserve,
      };
      stats.elements += 1;
      stats.attributes += attrs.length;
      add(el);
      if (!selfClosing) {
        stack.push(el);
        stats.maxDepth = Math.max(stats.maxDepth, stack.length);
      } else stats.maxDepth = Math.max(stats.maxDepth, stack.length + 1);
      i = end + 1;
    }
  }
  return { nodes: root, stats };
}

const isBlank = (n: XmlNode) => n.type === 'text' && n.value.trim() === '';

/** Serializes nodes exactly as parsed (used for mixed content and xml:space="preserve"). */
function inline(nodes: readonly XmlNode[], o: XmlFormatOptions): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.value;
      if (n.type === 'raw') return o.removeComments && n.kind === 'comment' ? '' : n.value;
      const open = `<${[n.name, ...n.attrs].join(' ')}`;
      if (n.children.length === 0) return o.selfCloseEmpty ? `${open}/>` : `${open}></${n.name}>`;
      return `${open}>${inline(n.children, o)}</${n.name}>`;
    })
    .join('');
}

function openTag(
  el: Extract<XmlNode, { type: 'element' }>,
  pad: string,
  unit: string,
  o: XmlFormatOptions,
  close: string,
): string {
  const oneLine = `<${[el.name, ...el.attrs].join(' ')}${close}`;
  const wrap =
    el.attrs.length > 1 &&
    (o.attributesPerLine === 'always' ||
      (o.attributesPerLine === 'auto' && pad.length + oneLine.length > o.lineWidth));
  if (!wrap) return oneLine;
  return `<${el.name}\n${el.attrs.map((a) => `${pad}${unit}${a}`).join('\n')}${close === '/>' ? '\n' + pad + '/>' : '\n' + pad + '>'}`;
}

function pretty(
  nodes: readonly XmlNode[],
  depth: number,
  unit: string,
  o: XmlFormatOptions,
): string[] {
  const pad = unit.repeat(depth);
  const out: string[] = [];
  for (const n of nodes) {
    if (isBlank(n)) continue;
    if (n.type === 'text') {
      out.push(pad + n.value.trim());
      continue;
    }
    if (n.type === 'raw') {
      if (!(o.removeComments && n.kind === 'comment')) out.push(pad + n.value);
      continue;
    }
    const children = n.children.filter(
      (c) => !(o.removeComments && c.type === 'raw' && c.kind === 'comment'),
    );
    const meaningful = children.filter((c) => !isBlank(c));
    if (meaningful.length === 0) {
      out.push(
        pad +
          (o.selfCloseEmpty
            ? openTag(n, pad, unit, o, '/>')
            : `${openTag(n, pad, unit, o, '>')}</${n.name}>`),
      );
      continue;
    }
    const hasText = children.some((c) => c.type === 'text' && c.value.trim() !== '');
    const onlyText = meaningful.every(
      (c) => c.type === 'text' || (c.type === 'raw' && c.kind === 'cdata'),
    );
    if (n.preserve || (hasText && !onlyText)) {
      // Mixed content or xml:space="preserve": whitespace is significant, keep it.
      out.push(`${pad}${openTag(n, pad, unit, o, '>')}${inline(children, o)}</${n.name}>`);
      continue;
    }
    if (onlyText) {
      const content = meaningful
        .map((c) => (c.type === 'text' ? c.value.trim() : c.type === 'raw' ? c.value : ''))
        .join('');
      out.push(`${pad}${openTag(n, pad, unit, o, '>')}${content}</${n.name}>`);
      continue;
    }
    out.push(pad + openTag(n, pad, unit, o, '>'));
    out.push(...pretty(children, depth + 1, unit, o));
    out.push(`${pad}</${n.name}>`);
  }
  return out;
}

function prepare(text: string) {
  if (!text.trim()) throw new ValidationError('The XML input is empty.');
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  validateXmlSyntax(source);
  return parseTree(source);
}

export function formatXml(
  text: string,
  options: Partial<XmlFormatOptions> = {},
): { text: string; stats: XmlStats } {
  const o = { ...DEFAULT_XML_FORMAT, ...options };
  const { nodes, stats } = prepare(text);
  const unit = o.indent === 'tab' ? '\t' : ' '.repeat(o.indent);
  return { text: `${pretty(nodes, 0, unit, o).join('\n')}\n`, stats };
}

/** Removes indentation and whitespace-only text between tags (text content is kept). */
export function minifyXml(
  text: string,
  options: { removeComments?: boolean } = {},
): { text: string; stats: XmlStats } {
  const { nodes, stats } = prepare(text);
  const o = { ...DEFAULT_XML_FORMAT, removeComments: options.removeComments ?? false };
  const strip = (list: XmlNode[]): XmlNode[] =>
    list
      .filter((n) => !isBlank(n) && !(o.removeComments && n.type === 'raw' && n.kind === 'comment'))
      .map((n) =>
        n.type === 'element' && !n.preserve ? { ...n, children: strip(n.children) } : n,
      );
  return { text: inline(strip(nodes), o), stats };
}
