/**
 * Languages with syntax highlighting (registered in monacoSetup.ts). Kept free of Monaco imports
 * so option lists can be built without loading the editor.
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
