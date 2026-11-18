import { rankBy } from '@/core/search/fuzzy';
import type { EntitySearchResult, SearchEntityKind } from '@/services/db/repositories';
import { resolveTools } from '@/tools/toolRegistry';
import { searchTools } from '@/tools/toolSearch';
import type { ToolDefinition } from '@/types/tools';

export interface PaletteAction {
  id: string;
  title: string;
  keywords: readonly string[];
  hint?: string;
  run: () => void;
}

export type PaletteItem =
  | { type: 'tool'; key: string; tool: ToolDefinition }
  | { type: 'action'; key: string; action: PaletteAction }
  | { type: 'entity'; key: string; entity: EntitySearchResult };

export interface PaletteGroup {
  id: string;
  label: string;
  items: PaletteItem[];
}

export const ENTITY_GROUP_LABELS: Record<SearchEntityKind, string> = {
  request: 'Saved requests',
  document: 'JSON documents',
  query: 'SQL scripts',
  snippet: 'Code snippets',
  history: 'History',
};

const ENTITY_ORDER: SearchEntityKind[] = ['request', 'document', 'query', 'snippet', 'history'];

export interface BuildPaletteInput {
  query: string;
  actions: readonly PaletteAction[];
  recentToolIds: readonly string[];
  entities: readonly EntitySearchResult[];
  toolLimit?: number;
}

/** Parses the ">" action prefix. */
export function parsePaletteQuery(raw: string): { actionsOnly: boolean; text: string } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('>')) return { actionsOnly: true, text: trimmed.slice(1).trim() };
  return { actionsOnly: false, text: raw.trim() };
}

/** Builds grouped palette results. Empty query → recent tools + actions. */
export function buildPaletteGroups({
  query,
  actions,
  recentToolIds,
  entities,
  toolLimit = 8,
}: BuildPaletteInput): PaletteGroup[] {
  const { actionsOnly, text } = parsePaletteQuery(query);
  const groups: PaletteGroup[] = [];

  const rankedActions = rankBy(text, actions, (a) => ({ title: a.title, secondary: a.keywords }));
  const actionGroup: PaletteGroup = {
    id: 'actions',
    label: 'Actions',
    items: rankedActions.map((action) => ({ type: 'action', key: `action:${action.id}`, action })),
  };

  if (actionsOnly) return actionGroup.items.length ? [actionGroup] : [];

  if (!text) {
    const recent = resolveTools(recentToolIds).slice(0, 5);
    if (recent.length) {
      groups.push({
        id: 'recent',
        label: 'Recent tools',
        items: recent.map((tool) => ({ type: 'tool', key: `recent:${tool.id}`, tool })),
      });
    }
    if (actionGroup.items.length) groups.push(actionGroup);
    return groups;
  }

  const tools = searchTools(text, { limit: toolLimit, recentToolIds });
  if (tools.length) {
    groups.push({
      id: 'tools',
      label: 'Tools',
      items: tools.map((tool) => ({ type: 'tool', key: `tool:${tool.id}`, tool })),
    });
  }

  for (const kind of ENTITY_ORDER) {
    const items = entities.filter((e) => e.kind === kind);
    if (items.length) {
      groups.push({
        id: kind,
        label: ENTITY_GROUP_LABELS[kind],
        items: items.map((entity) => ({ type: 'entity', key: `${kind}:${entity.id}`, entity })),
      });
    }
  }

  if (actionGroup.items.length)
    groups.push({ ...actionGroup, items: actionGroup.items.slice(0, 4) });
  return groups;
}

/** Route that opens a saved entity in its owning module. */
export function entityPath(entity: EntitySearchResult): string {
  const id = encodeURIComponent(entity.id);
  switch (entity.kind) {
    case 'request':
      return `/api/requests?request=${id}`;
    case 'document':
      return `/json/formatter?document=${id}`;
    case 'query':
      return `/sql/formatter?query=${id}`;
    case 'snippet':
      return `/snippets?snippet=${id}`;
    case 'history':
      return `/history?entry=${id}`;
  }
}
