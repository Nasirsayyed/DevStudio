import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders GitHub-flavoured Markdown and collects headings', () => {
    const r = renderMarkdown(
      '# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n~~old~~ `code`\n\n## Next',
    );
    expect(r.html).toContain('<h1>Title</h1>');
    expect(r.html).toContain('<table>');
    expect(r.html).toContain('type="checkbox"');
    expect(r.html).toContain('<del>old</del>');
    expect(r.headings).toEqual([
      { level: 1, text: 'Title' },
      { level: 2, text: 'Next' },
    ]);
  });

  it('supports line breaks as <br> and plain CommonMark', () => {
    expect(renderMarkdown('a\nb', { breaks: true }).html).toContain('<br>');
    expect(renderMarkdown('a\nb').html).not.toContain('<br>');
    expect(renderMarkdown('~~x~~', { gfm: false }).html).not.toContain('<del>');
    expect(renderMarkdown('').html).toBe('');
  });

  it('does not sanitize by itself (the sanitizer must run before display)', () => {
    expect(renderMarkdown('<script>alert(1)</script>').html).toContain('<script>');
  });
});
