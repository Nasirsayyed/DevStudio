import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '@/core/markdown/markdown';
import { previewDocument, sanitizeHtml } from './sanitize';

/** A corpus of classic XSS vectors; none may survive sanitization. */
const XSS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<form action="javascript:alert(1)"><button>x</button></form>',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
  '<body onload=alert(1)>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<template><script>alert(1)</script></template>',
  '"><img src=x onerror=alert(1)>',
];

describe('sanitizeHtml', () => {
  it.each(XSS)('neutralizes %s', (payload) => {
    const { html } = sanitizeHtml(payload);
    expect(html).not.toMatch(
      /<script|onerror|onload|ontoggle|onfocus|javascript:|<iframe|<object|<embed|<form|<meta|<base/i,
    );
  });

  it('keeps ordinary formatting, tables, code and inline images', () => {
    const { html, blockedResources, removed } = sanitizeHtml(
      '<h1 id="t">Title</h1><p><b>bold</b> <code>x</code></p><table><tr><td>1</td></tr></table><img alt="dot" src="data:image/png;base64,iVBORw0KGgo=">',
    );
    expect(html).toContain('<h1 id="t">Title</h1>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(blockedResources).toBe(0);
    expect(removed).toEqual({});
  });

  it('blocks every external resource (tracking pixels, remote CSS and fonts)', () => {
    const r = sanitizeHtml(
      '<img src="https://tracker.example/p.gif"><img srcset="https://x/a.png 2x"><style>@import url(https://x/a.css); body{background:url("https://x/b.png")} .ok{background:url(data:image/png;base64,AA==)}</style><div style="background-image:url(//x/c.png)">x</div><video poster="https://x/p.jpg"></video>',
    );
    expect(r.html).not.toMatch(/https?:|\/\/x/);
    expect(r.html).toContain('url(data:image/png;base64,AA==)');
    expect(r.blockedResources).toBe(6);
  });

  it('opens links in a new tab without referrer, and keeps in-page anchors', () => {
    const { html } = sanitizeHtml('<a href="https://example.com">e</a><a href="#top">t</a>');
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">e</a>',
    );
    expect(html).toContain('<a href="#top">t</a>');
  });

  it('keeps task-list checkboxes but disables every form control', () => {
    const { html, removed } = sanitizeHtml(
      '<ul><li><input type="checkbox" checked> done</li></ul><form><button formaction="https://x">b</button><input name="q"></form>',
    );
    expect(html).toContain('<input type="checkbox" checked="" disabled="">');
    expect(html).toContain('<input name="q" disabled="">');
    expect(html).not.toMatch(/<form|formaction/);
    expect(removed).toEqual({ '<form>': 1, 'formaction attribute': 1 });
  });

  it('reports what was removed', () => {
    const { removed } = sanitizeHtml('<p onclick="x()">a</p><script>1</script><script>2</script>');
    expect(removed).toEqual({ '<script>': 2, 'onclick attribute': 1 });
  });

  it('sanitizes Markdown output end to end', () => {
    const md = renderMarkdown(
      '# Hi\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))',
    ).html;
    const { html } = sanitizeHtml(md);
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).not.toMatch(/onerror|javascript:/i);
  });

  it('keeps a whole document when asked', () => {
    const { html } = sanitizeHtml(
      '<html><head><title>T</title><style>p{color:red}</style></head><body><p>x</p></body></html>',
      {
        wholeDocument: true,
      },
    );
    expect(html).toMatch(
      /^<html><head><title>T<\/title><style>p\{color:red\}<\/style><\/head><body><p>x<\/p><\/body><\/html>$/,
    );
  });
});

describe('previewDocument', () => {
  it('adds a restrictive CSP and the preview styles', () => {
    const doc = previewDocument('<p>x</p>', { css: 'p{margin:0}' });
    expect(doc).toContain(`content="default-src 'none'; img-src data:;`);
    expect(doc).toContain('<style>p{margin:0}</style>');
    expect(doc).toContain('<body><p>x</p></body>');
    expect(
      previewDocument('<html><head></head><body>y</body></html>', { css: '', wholeDocument: true }),
    ).toMatch(/^<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy"/);
  });
});
