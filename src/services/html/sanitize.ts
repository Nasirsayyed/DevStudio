import DOMPurify from 'dompurify';

/**
 * HTML sanitization for previews (Markdown and HTML preview). DOMPurify removes scripts, event
 * handlers, `javascript:` URLs, frames, forms and other active content. On top of that, every
 * reference to an external resource is removed, so a preview never contacts another server
 * (no tracking pixels, no remote CSS) and nothing violates the Content Security Policy.
 *
 * Needs a DOM (main thread only).
 */

export interface SanitizeOptions {
  /** Keep <html>/<head>/<body> (HTML preview) instead of returning a fragment. */
  wholeDocument?: boolean;
}

export interface SanitizeReport {
  html: string;
  /** Removed elements and attributes, e.g. { "<script>": 2, "onclick attribute": 1 }. */
  removed: Record<string, number>;
  /** External images, stylesheets, fonts and media that were blocked. */
  blockedResources: number;
}

const URL_ATTRIBUTES = ['src', 'srcset', 'poster', 'background', 'xlink:href', 'data'];
/** Only inline data is allowed for resources (images, fonts) so nothing is fetched. */
const isInlineResource = (url: string) => /^\s*(data:|#)/i.test(url);
const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
const CSS_IMPORT = /@import\s+[^;]+;?/gi;

function stripCssUrls(css: string, count: () => void): string {
  return css
    .replace(CSS_IMPORT, () => {
      count();
      return '';
    })
    .replace(CSS_URL, (whole, _q: string, url: string) => {
      if (isInlineResource(url)) return whole;
      count();
      return 'none';
    });
}

export function sanitizeHtml(html: string, options: SanitizeOptions = {}): SanitizeReport {
  const purify = DOMPurify();
  let blockedResources = 0;
  const block = () => {
    blockedResources += 1;
  };

  purify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return;
    for (const attr of URL_ATTRIBUTES) {
      const value = node.getAttribute(attr);
      if (value !== null && !isInlineResource(value)) {
        node.removeAttribute(attr);
        block();
      }
    }
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.getAttribute('href') ?? '';
      if (href.startsWith('#')) return;
      // Links open in a new tab, without referrer or access to this window.
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    // Form controls (e.g. Markdown task-list checkboxes) are shown but can never be used.
    if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(node.tagName)) {
      node.setAttribute('disabled', '');
    }
    const style = node.getAttribute('style');
    if (style) node.setAttribute('style', stripCssUrls(style, block));
  });
  purify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'style' && node.textContent) {
      node.textContent = stripCssUrls(node.textContent, block);
    }
    if (data.tagName === 'link' && node instanceof Element && node.getAttribute('href')) block();
  });

  const clean = purify.sanitize(html, {
    WHOLE_DOCUMENT: options.wholeDocument ?? false,
    // Allow <style> blocks (their URLs are stripped above); drop everything that can navigate,
    // submit, embed or change the document base. Form controls stay, disabled.
    ADD_TAGS: ['style'],
    FORBID_TAGS: ['base', 'link', 'meta', 'form', 'iframe', 'frame', 'object', 'embed', 'portal'],
    FORBID_ATTR: ['action', 'formaction', 'ping'],
    ALLOW_DATA_ATTR: true,
  });

  const removed: Record<string, number> = {};
  for (const item of purify.removed) {
    const r = item as { element?: Node; attribute?: Attr | null };
    let key: string | null = null;
    if (r.attribute) key = `${r.attribute.name} attribute`;
    else if (r.element instanceof Element) key = `<${r.element.tagName.toLowerCase()}>`;
    // Text/comment nodes and the implied <html>/<head>/<body> wrappers are not worth reporting.
    if (key === null || key === '<body>' || key === '<head>' || key === '<html>') continue;
    removed[key] = (removed[key] ?? 0) + 1;
  }
  return { html: clean, removed, blockedResources };
}

/**
 * Wraps sanitized HTML in a document for a sandboxed iframe. The document carries its own CSP,
 * so even if something slipped through the sanitizer, nothing could load or run.
 */
export function previewDocument(
  body: string,
  options: { css: string; wholeDocument?: boolean },
): string {
  const csp =
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; media-src data:";
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${options.css}</style>`;
  if (options.wholeDocument && /<head[\s>]/i.test(body))
    return body.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${head}`);
  if (options.wholeDocument && /<html[\s>]/i.test(body))
    return body.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}
