/**
 * Languages with syntax highlighting (registered in components/code-editor/monacoSetup.ts).
 * Pure data, so option lists, imports and exports work without loading the editor.
 */
export const CODE_LANGUAGES: readonly { id: string; label: string }[] = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'less', label: 'Less' },
  { id: 'csharp', label: 'C#' },
  { id: 'java', label: 'Java' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'cpp', label: 'C / C++' },
  { id: 'sql', label: 'SQL' },
  { id: 'shell', label: 'Shell' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'xml', label: 'XML' },
  { id: 'yaml', label: 'YAML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'ini', label: 'INI / properties' },
  { id: 'graphql', label: 'GraphQL' },
];

const BY_EXTENSION: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  cs: 'csharp',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  py: 'python',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  swift: 'swift',
  c: 'cpp',
  h: 'cpp',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  xml: 'xml',
  svg: 'xml',
  csproj: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  ini: 'ini',
  properties: 'ini',
  toml: 'ini',
  graphql: 'graphql',
  gql: 'graphql',
};

/** Guesses a language from a file name ("Dockerfile", "app.tsx"…). */
export function languageForFile(name: string): string | null {
  const base = name.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  if (base === 'dockerfile' || base.endsWith('.dockerfile')) return 'dockerfile';
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : '';
  return BY_EXTENSION[ext] ?? null;
}

/** Preferred file extension for downloads ("snippet.ts"). */
const EXTENSION: Record<string, string> = {
  plaintext: 'txt',
  javascript: 'js',
  typescript: 'ts',
  json: 'json',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  csharp: 'cs',
  java: 'java',
  kotlin: 'kt',
  python: 'py',
  go: 'go',
  rust: 'rs',
  php: 'php',
  ruby: 'rb',
  swift: 'swift',
  cpp: 'cpp',
  sql: 'sql',
  shell: 'sh',
  powershell: 'ps1',
  xml: 'xml',
  yaml: 'yaml',
  markdown: 'md',
  dockerfile: 'dockerfile',
  ini: 'ini',
  graphql: 'graphql',
};

export function extensionForLanguage(language: string): string {
  return EXTENSION[language] ?? 'txt';
}

export function isKnownLanguage(language: string): boolean {
  return CODE_LANGUAGES.some((l) => l.id === language);
}

export function languageLabel(language: string): string {
  return CODE_LANGUAGES.find((l) => l.id === language)?.label ?? language;
}

/**
 * Maps a VS Code snippet "scope" or a loose language name ("js", "C#", "bash") to a language id.
 */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  javascriptreact: 'javascript',
  jsx: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  typescriptreact: 'typescript',
  tsx: 'typescript',
  'c#': 'csharp',
  cs: 'csharp',
  py: 'python',
  python3: 'python',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  c: 'cpp',
  'c++': 'cpp',
  objc: 'cpp',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shellscript: 'shell',
  ps1: 'powershell',
  pwsh: 'powershell',
  yml: 'yaml',
  md: 'markdown',
  text: 'plaintext',
  txt: 'plaintext',
  plain: 'plaintext',
  docker: 'dockerfile',
  properties: 'ini',
  toml: 'ini',
  gql: 'graphql',
  htm: 'html',
  postgres: 'sql',
  mysql: 'sql',
  pgsql: 'sql',
  tsql: 'sql',
  sqlite: 'sql',
  kt: 'kotlin',
};

export function normalizeLanguage(value: string | undefined | null): string {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return 'plaintext';
  if (isKnownLanguage(v)) return v;
  return ALIASES[v] ?? 'plaintext';
}
