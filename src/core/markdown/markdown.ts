import { Marked } from 'marked';

/**
 * Markdown → HTML (GitHub-flavoured). The output is NOT safe to display as is: always pass it
 * through the HTML sanitizer (`services/html/sanitize`) before rendering.
 */

export interface MarkdownOptions {
  gfm: boolean;
  /** Treat single line breaks as <br>. */
  breaks: boolean;
}

export interface MarkdownHeading {
  level: number;
  text: string;
}

export function renderMarkdown(
  text: string,
  options: Partial<MarkdownOptions> = {},
): { html: string; headings: MarkdownHeading[]; words: number } {
  const marked = new Marked({
    gfm: options.gfm ?? true,
    breaks: options.breaks ?? false,
    async: false,
  });
  const headings: MarkdownHeading[] = [];
  const tokens = marked.lexer(text);
  void marked.walkTokens(tokens, (t) => {
    if (t.type === 'heading') headings.push({ level: t.depth as number, text: String(t.text) });
  });
  const html = marked.parser(tokens);
  const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  return { html, headings, words };
}
