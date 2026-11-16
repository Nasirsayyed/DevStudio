import type { PreparedRequest } from './build';
import { toCurl } from './curl';

/** Code that sends the same request from other environments. */

export const SNIPPET_LANGUAGES = [
  { id: 'curl', label: 'cURL', monaco: 'shell' },
  { id: 'fetch', label: 'JavaScript (fetch)', monaco: 'javascript' },
  { id: 'python', label: 'Python (requests)', monaco: 'python' },
  { id: 'csharp', label: 'C# (HttpClient)', monaco: 'csharp' },
] as const;
export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number]['id'];

const js = (s: string) => JSON.stringify(s);
const py = (s: string) => JSON.stringify(s);
const cs = (s: string) =>
  `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;

function fetchSnippet(p: PreparedRequest): string {
  const lines: string[] = [];
  const opts: string[] = [`  method: ${js(p.method)},`];
  if (p.headers.length)
    opts.push(
      `  headers: {\n${p.headers.map(([k, v]) => `    ${js(k)}: ${js(v)},`).join('\n')}\n  },`,
    );
  if (p.body.kind === 'text') opts.push(`  body: ${js(p.body.text)},`);
  if (p.body.kind === 'form-data') {
    lines.push('const form = new FormData();');
    for (const f of p.body.fields)
      lines.push(
        f.fileEntryId
          ? `form.append(${js(f.key)}, fileInput.files[0]); // ${f.value || 'file'}`
          : `form.append(${js(f.key)}, ${js(f.value)});`,
      );
    lines.push('');
    opts.push('  body: form,');
  }
  if (p.body.kind === 'binary') opts.push('  body: file, // a File or Blob');
  lines.push(
    `const response = await fetch(${js(p.url)}, {\n${opts.join('\n')}\n});`,
    'const data = await response.text();',
    'console.log(response.status, data);',
  );
  return `${lines.join('\n')}\n`;
}

function pythonSnippet(p: PreparedRequest): string {
  const lines = ['import requests', ''];
  const args = [js(p.method), py(p.url)];
  if (p.headers.length) {
    lines.push(
      `headers = {\n${p.headers.map(([k, v]) => `    ${py(k)}: ${py(v)},`).join('\n')}\n}`,
    );
    args.push('headers=headers');
  }
  if (p.body.kind === 'text') {
    lines.push(`data = ${py(p.body.text)}`);
    args.push('data=data.encode("utf-8")');
  }
  if (p.body.kind === 'form-data') {
    const text = p.body.fields.filter((f) => !f.fileEntryId);
    const files = p.body.fields.filter((f) => f.fileEntryId);
    if (text.length) {
      lines.push(`data = {\n${text.map((f) => `    ${py(f.key)}: ${py(f.value)},`).join('\n')}\n}`);
      args.push('data=data');
    }
    if (files.length) {
      lines.push(
        `files = {\n${files.map((f) => `    ${py(f.key)}: open(${py(f.value || 'file')}, "rb"),`).join('\n')}\n}`,
      );
      args.push('files=files');
    }
  }
  if (p.body.kind === 'binary') args.push('data=open("file", "rb")');
  lines.push(
    '',
    `response = requests.request(${args.join(', ')})`,
    'print(response.status_code, response.text)',
  );
  return `${lines.join('\n')}\n`;
}

function csharpSnippet(p: PreparedRequest): string {
  const lines = [
    'using var client = new HttpClient();',
    `using var request = new HttpRequestMessage(new HttpMethod(${cs(p.method)}), ${cs(p.url)});`,
  ];
  const content = p.headers.filter(([k]) => /^content-/i.test(k));
  for (const [k, v] of p.headers.filter(([k2]) => !/^content-/i.test(k2)))
    lines.push(`request.Headers.TryAddWithoutValidation(${cs(k)}, ${cs(v)});`);
  if (p.body.kind === 'text') {
    lines.push(`request.Content = new StringContent(${cs(p.body.text)});`);
    for (const [k, v] of content) {
      lines.push(
        `request.Content.Headers.Remove(${cs(k)});`,
        `request.Content.Headers.TryAddWithoutValidation(${cs(k)}, ${cs(v)});`,
      );
    }
  }
  if (p.body.kind === 'form-data') {
    lines.push('var form = new MultipartFormDataContent();');
    for (const f of p.body.fields)
      lines.push(
        f.fileEntryId
          ? `form.Add(new StreamContent(File.OpenRead(${cs(f.value || 'file')})), ${cs(f.key)}, ${cs(f.value || 'file')});`
          : `form.Add(new StringContent(${cs(f.value)}), ${cs(f.key)});`,
      );
    lines.push('request.Content = form;');
  }
  if (p.body.kind === 'binary')
    lines.push('request.Content = new StreamContent(File.OpenRead("file"));');
  lines.push(
    '',
    'using var response = await client.SendAsync(request);',
    'var body = await response.Content.ReadAsStringAsync();',
    'Console.WriteLine($"{(int)response.StatusCode} {body}");',
  );
  return `${lines.join('\n')}\n`;
}

export function requestSnippet(p: PreparedRequest, language: SnippetLanguage): string {
  switch (language) {
    case 'curl':
      return `${toCurl(p)}\n`;
    case 'fetch':
      return fetchSnippet(p);
    case 'python':
      return pythonSnippet(p);
    case 'csharp':
      return csharpSnippet(p);
  }
}
