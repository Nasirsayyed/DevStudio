import {
  ArrowSwapHorizontal,
  Calendar1,
  Colorfilter,
  DocumentFilter,
  Eye,
  Hashtag,
  Hierarchy,
  Key,
  Link2,
  PasswordCheck,
  Repeat,
  SearchNormal1,
  ShieldTick,
  Shuffle,
  Sort,
  TableDocument,
  TickCircle,
  Timer1,
  Translate,
} from 'iconsax-reactjs';
import type { ModuleDefinition, ModuleId, ToolDefinition } from '@/types/tools';
import { MODULES, getModule } from './modules';

type ToolSeed = Omit<ToolDefinition, 'id' | 'moduleId' | 'phase'> & { phase?: number };

function defineTools(moduleId: ModuleId, seeds: readonly ToolSeed[]): ToolDefinition[] {
  const mod = getModule(moduleId);
  return seeds.map((seed) => ({
    ...seed,
    id: `${moduleId}.${seed.slug}`,
    moduleId,
    phase: seed.phase ?? mod.phase,
  }));
}

/**
 * Every tool in DevStudio. Tool ids are persisted (favorites, history, usage),
 * so they must never be renamed — add an `aliasOf` entry instead.
 */
export const TOOLS: readonly ToolDefinition[] = [
  ...defineTools('api', [
    {
      slug: 'requests',
      title: 'Request Builder',
      description: 'Compose and send HTTP requests with params, headers, auth and body.',
      keywords: ['http', 'rest', 'postman', 'fetch', 'get', 'post', 'request'],
      icon: Link2,
    },
    {
      slug: 'environments',
      title: 'Environments',
      description: 'Manage Development, Testing, Staging, Production and custom variables.',
      keywords: ['variables', 'env', 'staging', 'production'],
    },
    {
      slug: 'runner',
      title: 'Collection Runner',
      description: 'Run request collections with chained values and JSON assertions.',
      keywords: ['tests', 'assertions', 'chaining', 'collection'],
    },
    {
      slug: 'history',
      title: 'Request History',
      description: 'Browse previously sent requests and their responses.',
      keywords: ['log', 'previous', 'responses'],
    },
    {
      slug: 'compare',
      title: 'Response Compare',
      description: 'Compare two API responses side by side.',
      keywords: ['diff', 'response'],
      icon: ArrowSwapHorizontal,
    },
  ]),
  ...defineTools('json', [
    {
      slug: 'formatter',
      title: 'JSON Formatter',
      description: 'Pretty-print JSON with configurable indentation.',
      keywords: ['format', 'pretty', 'indent'],
    },
    {
      slug: 'validator',
      title: 'JSON Validator',
      description: 'Validate JSON syntax and pinpoint the error line.',
      keywords: ['validate', 'lint', 'syntax', 'error'],
      icon: TickCircle,
    },
    {
      slug: 'minifier',
      title: 'JSON Minifier',
      description: 'Remove whitespace to produce compact JSON.',
      keywords: ['minify', 'compact', 'compress'],
    },
    {
      slug: 'beautifier',
      title: 'JSON Beautifier',
      description: 'Beautify JSON with sorted keys and custom spacing options.',
      keywords: ['beautify', 'pretty'],
    },
    {
      slug: 'tree',
      title: 'JSON Tree Viewer',
      description: 'Explore JSON as an expandable, searchable tree.',
      keywords: ['tree', 'explore', 'viewer', 'inspect'],
      icon: Hierarchy,
    },
    {
      slug: 'compare',
      title: 'JSON Compare',
      description: 'Structural diff: missing properties and type differences.',
      keywords: ['diff', 'compare', 'difference'],
      icon: ArrowSwapHorizontal,
    },
    {
      slug: 'path-finder',
      title: 'JSON Path Finder',
      description: 'Click any value to get its JSONPath expression.',
      keywords: ['path', 'locate', 'jsonpath'],
    },
    {
      slug: 'jsonpath',
      title: 'JSONPath Tester',
      description: 'Evaluate JSONPath queries against a document.',
      keywords: ['query', 'jsonpath', 'select', 'filter'],
      icon: SearchNormal1,
    },
    {
      slug: 'schema-generator',
      title: 'JSON Schema Generator',
      description: 'Infer a JSON Schema from sample data.',
      keywords: ['schema', 'generate', 'infer'],
    },
    {
      slug: 'schema-validator',
      title: 'JSON Schema Validator',
      description: 'Validate a document against a JSON Schema.',
      keywords: ['schema', 'validate', 'ajv'],
      icon: ShieldTick,
    },
    {
      slug: 'flatten',
      title: 'JSON Flatten',
      description: 'Flatten nested JSON into dotted key paths.',
      keywords: ['flatten', 'dot notation'],
    },
    {
      slug: 'unflatten',
      title: 'JSON Unflatten',
      description: 'Rebuild nested JSON from dotted key paths.',
      keywords: ['unflatten', 'nest'],
    },
    {
      slug: 'search',
      title: 'JSON Search',
      description: 'Search keys and values across a JSON document.',
      keywords: ['find', 'search', 'grep'],
      icon: SearchNormal1,
    },
    {
      slug: 'sort-keys',
      title: 'JSON Sort Keys',
      description: 'Recursively sort object keys alphabetically.',
      keywords: ['sort', 'order', 'keys'],
      icon: Sort,
    },
    {
      slug: 'to-csv',
      title: 'JSON to CSV',
      description: 'Convert a JSON array of objects to CSV.',
      keywords: ['csv', 'export', 'spreadsheet'],
      icon: TableDocument,
    },
    {
      slug: 'from-csv',
      title: 'CSV to JSON',
      description: 'Convert CSV with headers into a JSON array.',
      keywords: ['csv', 'import', 'parse'],
      icon: TableDocument,
    },
  ]),
  ...defineTools('codegen', [
    {
      slug: 'csharp',
      title: 'JSON to C#',
      description: 'Generate C# classes with nullable types, JsonPropertyName and namespaces.',
      keywords: ['c#', 'csharp', 'dotnet', '.net', 'class', 'poco', 'model'],
    },
    {
      slug: 'typescript',
      title: 'JSON to TypeScript',
      description: 'Generate TypeScript interfaces or types from JSON.',
      keywords: ['ts', 'typescript', 'interface', 'type'],
    },
    {
      slug: 'java',
      title: 'JSON to Java',
      description: 'Generate Java classes or records from JSON.',
      keywords: ['java', 'pojo', 'record', 'jackson'],
    },
    {
      slug: 'python',
      title: 'JSON to Python',
      description: 'Generate Python dataclasses or Pydantic models.',
      keywords: ['python', 'dataclass', 'pydantic'],
    },
    {
      slug: 'sql-table',
      title: 'JSON to SQL Table',
      description: 'Generate CREATE TABLE scripts from JSON data.',
      keywords: ['sql', 'ddl', 'create table'],
    },
    {
      slug: 'json-to-xml',
      title: 'JSON to XML',
      description: 'Convert JSON documents into XML.',
      keywords: ['xml', 'convert'],
      icon: Translate,
    },
    {
      slug: 'xml-to-json',
      title: 'XML to JSON',
      description: 'Convert XML documents into JSON.',
      keywords: ['xml', 'convert', 'parse'],
      icon: Translate,
    },
    {
      slug: 'json-to-csv',
      title: 'JSON to CSV',
      description: 'Convert a JSON array of objects to CSV.',
      keywords: ['csv'],
      icon: TableDocument,
      aliasOf: 'json.to-csv',
      phase: 4,
    },
  ]),
  ...defineTools('sql', [
    {
      slug: 'formatter',
      title: 'SQL Formatter',
      description: 'Format SQL for SQL Server, PostgreSQL, MySQL and SQLite.',
      keywords: ['format', 'pretty', 'beautify'],
    },
    {
      slug: 'minifier',
      title: 'SQL Minifier',
      description: 'Collapse SQL to a single compact line.',
      keywords: ['minify', 'compact'],
    },
    {
      slug: 'validator',
      title: 'SQL Validator',
      description: 'Parse SQL per dialect and report syntax errors.',
      keywords: ['validate', 'parse', 'syntax', 'lint'],
      icon: TickCircle,
    },
    {
      slug: 'query-generator',
      title: 'SQL Query Generator',
      description: 'Build SELECT, INSERT, UPDATE and DELETE statements visually.',
      keywords: ['builder', 'generate', 'crud'],
    },
    {
      slug: 'select-generator',
      title: 'SELECT Generator',
      description: 'Generate SELECT statements with filters, joins and ordering.',
      keywords: ['select', 'query'],
    },
    {
      slug: 'insert-generator',
      title: 'INSERT Generator',
      description: 'Generate INSERT statements from JSON or CSV data.',
      keywords: ['insert', 'seed', 'data'],
    },
    {
      slug: 'update-generator',
      title: 'UPDATE Generator',
      description: 'Generate UPDATE statements with WHERE clauses.',
      keywords: ['update'],
    },
    {
      slug: 'delete-generator',
      title: 'DELETE Generator',
      description: 'Generate safe DELETE statements.',
      keywords: ['delete'],
    },
    {
      slug: 'to-csharp',
      title: 'SQL to C#',
      description: 'Generate C# entity classes from CREATE TABLE scripts.',
      keywords: ['c#', 'csharp', 'entity', 'model'],
    },
    {
      slug: 'to-typescript',
      title: 'SQL to TypeScript',
      description: 'Generate TypeScript types from CREATE TABLE scripts.',
      keywords: ['ts', 'typescript', 'type'],
    },
    {
      slug: 'compare',
      title: 'SQL Query Compare',
      description: 'Diff two SQL scripts after normalized formatting.',
      keywords: ['diff', 'compare'],
      icon: ArrowSwapHorizontal,
    },
    {
      slug: 'schema-designer',
      title: 'Schema Designer',
      description: 'Design tables, keys and relationships; export DDL.',
      keywords: ['erd', 'schema', 'diagram', 'tables', 'foreign key'],
      icon: Hierarchy,
    },
    {
      slug: 'playground',
      title: 'SQLite Playground',
      description: 'Run SQL locally in the browser with SQLite (WebAssembly).',
      keywords: ['sqlite', 'execute', 'run', 'wasm', 'sql.js'],
    },
  ]),
  ...defineTools('utils', [
    {
      slug: 'base64',
      group: 'Encoding',
      title: 'Base64 Encode / Decode',
      description: 'Encode and decode Base64 (Unicode-safe, URL-safe variant).',
      keywords: ['base64', 'encode', 'decode', 'btoa', 'atob'],
    },
    {
      slug: 'url-encoding',
      group: 'Encoding',
      title: 'URL Encode / Decode',
      description: 'Percent-encode and decode URL components.',
      keywords: ['url', 'uri', 'percent', 'encode', 'decode'],
      icon: Link2,
    },
    {
      slug: 'html-entities',
      group: 'Encoding',
      title: 'HTML Entity Encode / Decode',
      description: 'Escape and unescape HTML entities.',
      keywords: ['html', 'entities', 'escape', 'unescape'],
    },
    {
      slug: 'jwt-decoder',
      group: 'Token',
      title: 'JWT Decoder',
      description: 'Decode JWT header and payload and check expiry.',
      keywords: ['jwt', 'token', 'decode', 'claims', 'expiry', 'header', 'payload'],
      icon: Key,
    },
    {
      slug: 'jwt-verify',
      group: 'Token',
      title: 'JWT Signature Verifier',
      description: 'Verify JWT signatures with a secret, PEM key or JWKS.',
      keywords: ['jwt', 'verify', 'signature', 'jwks', 'rsa', 'hmac'],
      icon: ShieldTick,
    },
    {
      slug: 'uuid',
      group: 'Generators',
      title: 'UUID Generator',
      description: 'Generate UUID v1, v4, v5 and v7 in bulk.',
      keywords: ['uuid', 'unique', 'id'],
      icon: Hashtag,
    },
    {
      slug: 'guid',
      group: 'Generators',
      title: 'GUID Generator',
      description: 'Generate GUIDs in .NET formats (braces, uppercase, N/D/B/P).',
      keywords: ['guid', 'dotnet', 'uuid'],
      icon: Hashtag,
    },
    {
      slug: 'random-string',
      group: 'Generators',
      title: 'Random String Generator',
      description: 'Cryptographically secure random strings.',
      keywords: ['random', 'string', 'token'],
      icon: Shuffle,
    },
    {
      slug: 'password',
      group: 'Generators',
      title: 'Password Generator',
      description: 'Secure passwords with strength estimation.',
      keywords: ['password', 'secure', 'strength'],
      icon: PasswordCheck,
    },
    {
      slug: 'hash',
      group: 'Generators',
      title: 'Hash Generator',
      description: 'MD5, SHA-1, SHA-256, SHA-384, SHA-512 and HMAC.',
      keywords: ['hash', 'md5', 'sha', 'sha256', 'hmac', 'checksum'],
      icon: Hashtag,
    },
    {
      slug: 'lorem-ipsum',
      group: 'Generators',
      title: 'Lorem Ipsum Generator',
      description: 'Placeholder words, sentences and paragraphs.',
      keywords: ['lorem', 'ipsum', 'placeholder', 'dummy text'],
    },
    {
      slug: 'unix-timestamp',
      group: 'Date & Time',
      title: 'Unix Timestamp Converter',
      description: 'Convert between timestamps, dates and UTC.',
      keywords: ['unix', 'epoch', 'timestamp', 'date', 'utc'],
      icon: Timer1,
    },
    {
      slug: 'timezone',
      group: 'Date & Time',
      title: 'Timezone Converter',
      description: 'Convert a date and time across time zones.',
      keywords: ['timezone', 'tz', 'utc', 'convert'],
      icon: Calendar1,
    },
    {
      slug: 'date-diff',
      group: 'Date & Time',
      title: 'Date Difference Calculator',
      description: 'Difference between two dates in multiple units.',
      keywords: ['date', 'difference', 'duration', 'days between'],
      icon: Calendar1,
    },
    {
      slug: 'color',
      group: 'Other',
      title: 'Color Converter',
      description: 'Convert HEX, RGB, HSL and check contrast.',
      keywords: ['color', 'hex', 'rgb', 'hsl', 'contrast'],
      icon: Colorfilter,
    },
    {
      slug: 'cron',
      group: 'Other',
      title: 'Cron Expression Helper',
      description: 'Explain cron expressions and preview next runs.',
      keywords: ['cron', 'schedule', 'crontab'],
      icon: Repeat,
    },
    {
      slug: 'mime',
      group: 'Other',
      title: 'MIME Type Lookup',
      description: 'Find MIME types by extension and vice versa.',
      keywords: ['mime', 'content-type', 'extension'],
    },
    {
      slug: 'user-agent',
      group: 'Other',
      title: 'User Agent Parser',
      description: 'Parse browser, engine, OS and device from a user agent.',
      keywords: ['user agent', 'ua', 'browser', 'device'],
    },
  ]),
  ...defineTools('text', [
    {
      slug: 'text-diff',
      title: 'Text Diff',
      description: 'Compare two texts side by side or inline.',
      keywords: ['diff', 'compare', 'text compare'],
      icon: ArrowSwapHorizontal,
    },
    {
      slug: 'code-diff',
      title: 'Code Diff',
      description: 'Syntax-highlighted code comparison with Monaco.',
      keywords: ['diff', 'code', 'compare'],
      icon: ArrowSwapHorizontal,
    },
    {
      slug: 'find-replace',
      title: 'Find and Replace',
      description: 'Find and replace with plain text or regular expressions.',
      keywords: ['find', 'replace', 'regex', 'search'],
      icon: SearchNormal1,
    },
    {
      slug: 'counter',
      title: 'Word & Character Counter',
      description: 'Count words, characters, lines and reading time.',
      keywords: ['count', 'words', 'characters', 'lines', 'counter'],
    },
    {
      slug: 'line-tools',
      title: 'Line Tools',
      description: 'Remove duplicates, sort, reverse and trim lines.',
      keywords: ['dedupe', 'duplicate', 'sort lines', 'unique', 'reverse'],
      icon: Sort,
    },
    {
      slug: 'reverse',
      title: 'Reverse Text',
      description: 'Reverse characters, words or lines.',
      keywords: ['reverse', 'flip'],
    },
    {
      slug: 'case-converter',
      title: 'Case Converter',
      description: 'camelCase, PascalCase, snake_case, kebab-case and more.',
      keywords: ['case', 'camel', 'pascal', 'snake', 'kebab', 'upper', 'lower'],
    },
    {
      slug: 'markdown-preview',
      title: 'Markdown Preview',
      description: 'Live, sanitized Markdown preview.',
      keywords: ['markdown', 'md', 'preview'],
      icon: Eye,
    },
    {
      slug: 'html-preview',
      title: 'HTML Preview',
      description: 'Render HTML safely in a sandboxed frame.',
      keywords: ['html', 'preview', 'render'],
      icon: Eye,
    },
    {
      slug: 'xml-formatter',
      title: 'XML Formatter',
      description: 'Format and validate XML.',
      keywords: ['xml', 'format', 'pretty'],
      icon: DocumentFilter,
    },
    {
      slug: 'yaml-formatter',
      title: 'YAML Formatter',
      description: 'Format and validate YAML; convert to/from JSON.',
      keywords: ['yaml', 'yml', 'format'],
      icon: DocumentFilter,
    },
  ]),
];

const TOOL_MAP = new Map<string, ToolDefinition>(TOOLS.map((t) => [t.id, t]));

export function getTool(id: string): ToolDefinition | undefined {
  return TOOL_MAP.get(id);
}

export function getToolBySlug(moduleId: ModuleId, slug: string): ToolDefinition | undefined {
  return TOOL_MAP.get(`${moduleId}.${slug}`);
}

export function getToolsByModule(moduleId: ModuleId): ToolDefinition[] {
  return TOOLS.filter((t) => t.moduleId === moduleId);
}

/** Tools excluding aliases — used for counts and statistics. */
export const CANONICAL_TOOLS: readonly ToolDefinition[] = TOOLS.filter((t) => !t.aliasOf);

export function toolPath(tool: ToolDefinition): string {
  return `${getModule(tool.moduleId).path}/${tool.slug}`;
}

export function getToolModule(tool: ToolDefinition): ModuleDefinition {
  return getModule(tool.moduleId);
}

export function getToolIcon(tool: ToolDefinition) {
  return tool.icon ?? getModule(tool.moduleId).icon;
}

/** Resolves ids to tools, skipping unknown ids (e.g. tools removed in a later version). */
export function resolveTools(ids: readonly string[]): ToolDefinition[] {
  return ids.map((id) => TOOL_MAP.get(id)).filter((t): t is ToolDefinition => t !== undefined);
}

export { MODULES };
