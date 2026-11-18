export const SAMPLE_TEXT = `DevStudio is a browser-based developer toolbox. It runs entirely on your device.
Nothing you paste here is uploaded.

Use the line tools to sort, dedupe and number lines.
Use the case converter for camelCase, snake_case and kebab-case.
Use find and replace with regular expressions: dates like 2024-01-31 or emails like dev@example.com.
`;

export const SAMPLE_DIFF_LEFT = `{
  "name": "devstudio",
  "version": "0.3.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest"
  }
}
`;

export const SAMPLE_DIFF_RIGHT = `{
  "name": "devstudio",
  "version": "0.4.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc -b && vite build",
    "e2e": "playwright test"
  }
}
`;

export const SAMPLE_CODE_LEFT = `export function total(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price * item.quantity;
  }
  return sum;
}
`;

export const SAMPLE_CODE_RIGHT = `export function total(items: Item[], taxRate = 0): number {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Math.round(subtotal * (1 + taxRate) * 100) / 100;
}
`;

export const SAMPLE_MARKDOWN = `# Release notes

DevStudio **0.5** adds *Text Tools*. Everything runs locally — see the [README](https://github.com).

## Highlights

- [x] Text and code diff
- [x] Find & replace with \`RegExp\`
- [ ] Snippets (next)

| Tool | Runs in |
| ---- | ------- |
| Diff | Web Worker |
| Preview | Sandboxed frame |

> Scripts in Markdown are removed: <img src=x onerror="alert('xss')">

\`\`\`ts
const greeting: string = 'hello';
\`\`\`
`;

export const SAMPLE_HTML = `<!doctype html>
<html>
<head>
  <title>Card</title>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 90vh; }
    .card { padding: 24px 28px; border-radius: 16px; background: linear-gradient(135deg, #4f46e5, #9333ea); color: white; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello from HTML Preview</h1>
    <p onclick="alert('removed')">Event handlers and scripts are removed.</p>
    <script>alert('this never runs')</script>
    <img src="https://tracker.example/pixel.gif" alt="Blocked remote image">
  </div>
</body>
</html>
`;

export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<catalog><!-- Books --><book id="bk101" lang="en"><author>Gambardella, Matthew</author><title>XML Developer's Guide</title><price currency="USD">44.95</price><description>An in-depth look at <b>XML</b> applications.</description></book><book id="bk102"><author>Ralls, Kim</author><title>Midnight Rain</title><price currency="USD">5.95</price><tags/></book></catalog>
`;

export const SAMPLE_YAML = `# Deployment
service:   api
replicas: 3
image: {name: devstudio/api, tag: "1.4.2"}
env:
    - name: LOG_LEVEL
      value: info
    - {name: FEATURE_FLAGS, value: "search,export"}
defaults: &defaults
  timeout: 30
  retries: 2
production:
  <<: *defaults
  timeout: 60
`;
