import type { ToolPageComponent } from '@/types/tools';

type ToolPageLoader = () => Promise<{ default: ToolPageComponent }>;

/**
 * Lazy page loaders for implemented tools, keyed by tool id. Each entry
 * becomes its own code-split chunk. Tools without an entry render the
 * "scheduled" state with their roadmap phase, never a fake UI.
 *
 * Example (Phase 4):
 *   'json.formatter': () => import('@/features/json-studio/pages/JsonFormatterPage'),
 */
export const TOOL_PAGES: Readonly<Partial<Record<string, ToolPageLoader>>> = {};

export function getToolPageLoader(toolId: string): ToolPageLoader | undefined {
  return TOOL_PAGES[toolId];
}

export function isToolAvailable(toolId: string): boolean {
  return toolId in TOOL_PAGES;
}
