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
};

export function getToolPageLoader(toolId: string): ToolPageLoader | undefined {
  return TOOL_PAGES[toolId];
}

export function isToolAvailable(toolId: string): boolean {
  return toolId in TOOL_PAGES;
}
