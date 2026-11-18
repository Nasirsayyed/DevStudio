import type { ComponentType } from 'react';
import type { Icon } from 'iconsax-reactjs';

export type ModuleId =
  | 'dashboard'
  | 'api'
  | 'json'
  | 'codegen'
  | 'sql'
  | 'utils'
  | 'text'
  | 'snippets'
  | 'history'
  | 'favorites'
  | 'settings';

export interface ModuleDefinition {
  id: ModuleId;
  title: string;
  /** Short label for compact UI (breadcrumbs, chips). */
  shortTitle: string;
  description: string;
  path: string;
  icon: Icon;
  /** Roadmap phase in which the module is delivered (docs/IMPLEMENTATION_PLAN.md). */
  phase: number;
  /** True when the module has multiple tools reachable via /<path>/:toolSlug. */
  hasTools: boolean;
  /** Sidebar grouping. */
  section: 'main' | 'workspace' | 'system';
}

export type ToolPageComponent = ComponentType;

export interface ToolDefinition {
  /** Globally unique id: "<moduleId>.<slug>". Persisted in favorites/history — never rename. */
  id: string;
  moduleId: ModuleId;
  slug: string;
  title: string;
  description: string;
  keywords: readonly string[];
  /** Optional sub-group inside a module (e.g. "Encoding" in Developer Utilities). */
  group?: string;
  icon?: Icon;
  phase: number;
  /** When set, this entry is an alias of another tool and routes to it (no duplicated code). */
  aliasOf?: string;
}
