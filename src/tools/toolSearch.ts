import { rankBy } from '@/core/search/fuzzy';
import type { ToolDefinition } from '@/types/tools';
import { getModule } from './modules';
import { CANONICAL_TOOLS } from './toolRegistry';

/** Small tie-breaker so recently used tools win among similarly relevant matches. */
const RECENT_BONUS = 30;

export interface SearchToolsOptions {
  tools?: readonly ToolDefinition[];
  limit?: number;
  /** Recently used tool ids, most recent first. */
  recentToolIds?: readonly string[];
}

/**
 * The single tool-search implementation used by the command palette, dashboard,
 * favorites, quick-access dialog and module pages. Matches title (highest),
 * keywords, module name and description; boosts tools of a module named in the
 * query and recently used tools.
 */
export function searchTools(query: string, options: SearchToolsOptions = {}): ToolDefinition[] {
  const { tools = CANONICAL_TOOLS, limit, recentToolIds = [] } = options;
  const recent = new Set(recentToolIds);
  return rankBy(
    query,
    tools,
    (t) => {
      const mod = getModule(t.moduleId);
      return {
        title: t.title,
        secondary: [...t.keywords, mod.title, t.description],
        context: [mod.shortTitle],
        bonus: recent.has(t.id) ? RECENT_BONUS : 0,
      };
    },
    limit,
  );
}
