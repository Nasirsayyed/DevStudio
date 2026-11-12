import type { ToolPageComponent } from '@/types/tools';

type ToolPageLoader = () => Promise<{ default: ToolPageComponent }>;

/**
 * Lazy page loaders for implemented tools, keyed by tool id. Each entry
 * becomes its own code-split chunk. Tools without an entry render the
 * "scheduled" state with their roadmap phase, never a fake UI.
 */
export const TOOL_PAGES: Readonly<Partial<Record<string, ToolPageLoader>>> = {
  // JSON Studio (Phase 4)
  'json.formatter': () => import('@/features/json-studio/pages/JsonFormatterPage'),
  'json.validator': () => import('@/features/json-studio/pages/JsonValidatorPage'),
  'json.minifier': () => import('@/features/json-studio/pages/JsonMinifierPage'),
  'json.beautifier': () => import('@/features/json-studio/pages/JsonBeautifierPage'),
  'json.tree': () => import('@/features/json-studio/pages/JsonTreePage'),
  'json.compare': () => import('@/features/json-studio/pages/JsonComparePage'),
  'json.path-finder': () => import('@/features/json-studio/pages/JsonPathFinderPage'),
  'json.jsonpath': () => import('@/features/json-studio/pages/JsonPathTesterPage'),
  'json.schema-generator': () => import('@/features/json-studio/pages/JsonSchemaGeneratorPage'),
  'json.schema-validator': () => import('@/features/json-studio/pages/JsonSchemaValidatorPage'),
  'json.flatten': () => import('@/features/json-studio/pages/JsonFlattenPage'),
  'json.unflatten': () => import('@/features/json-studio/pages/JsonUnflattenPage'),
  'json.search': () => import('@/features/json-studio/pages/JsonSearchPage'),
  'json.sort-keys': () => import('@/features/json-studio/pages/JsonSortKeysPage'),
  'json.to-csv': () => import('@/features/json-studio/pages/JsonToCsvPage'),
  'json.from-csv': () => import('@/features/json-studio/pages/JsonFromCsvPage'),
  // Code Generators (Phase 5) — "codegen.json-to-csv" is an alias of json.to-csv.
  'codegen.csharp': () => import('@/features/code-generators/pages/CSharpGeneratorPage'),
  'codegen.typescript': () => import('@/features/code-generators/pages/TypeScriptGeneratorPage'),
  'codegen.java': () => import('@/features/code-generators/pages/JavaGeneratorPage'),
  'codegen.python': () => import('@/features/code-generators/pages/PythonGeneratorPage'),
  'codegen.sql-table': () => import('@/features/code-generators/pages/SqlTableGeneratorPage'),
  'codegen.json-to-xml': () => import('@/features/code-generators/pages/JsonToXmlPage'),
  'codegen.xml-to-json': () => import('@/features/code-generators/pages/XmlToJsonPage'),
  // Developer Utilities (Phase 6)
  'utils.base64': () => import('@/features/dev-utilities/pages/Base64Page'),
  'utils.url-encoding': () => import('@/features/dev-utilities/pages/UrlEncodingPage'),
  'utils.html-entities': () => import('@/features/dev-utilities/pages/HtmlEntitiesPage'),
  'utils.jwt-decoder': () => import('@/features/dev-utilities/pages/JwtDecoderPage'),
  'utils.jwt-verify': () => import('@/features/dev-utilities/pages/JwtVerifyPage'),
  'utils.uuid': () => import('@/features/dev-utilities/pages/UuidPage'),
  'utils.guid': () => import('@/features/dev-utilities/pages/GuidPage'),
  'utils.random-string': () => import('@/features/dev-utilities/pages/RandomStringPage'),
  'utils.password': () => import('@/features/dev-utilities/pages/PasswordPage'),
  'utils.hash': () => import('@/features/dev-utilities/pages/HashPage'),
  'utils.lorem-ipsum': () => import('@/features/dev-utilities/pages/LoremIpsumPage'),
  'utils.unix-timestamp': () => import('@/features/dev-utilities/pages/UnixTimestampPage'),
  'utils.timezone': () => import('@/features/dev-utilities/pages/TimezonePage'),
  'utils.date-diff': () => import('@/features/dev-utilities/pages/DateDiffPage'),
  'utils.color': () => import('@/features/dev-utilities/pages/ColorPage'),
  'utils.cron': () => import('@/features/dev-utilities/pages/CronPage'),
  'utils.mime': () => import('@/features/dev-utilities/pages/MimePage'),
  'utils.user-agent': () => import('@/features/dev-utilities/pages/UserAgentPage'),
};

export function getToolPageLoader(toolId: string): ToolPageLoader | undefined {
  return TOOL_PAGES[toolId];
}

export function isToolAvailable(toolId: string): boolean {
  return toolId in TOOL_PAGES;
}
