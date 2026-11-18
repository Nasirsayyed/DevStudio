import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { favoritesRepository } from '@/services/db/repositories';
import { resolveTools } from '@/tools/toolRegistry';
import type { ToolDefinition } from '@/types/tools';

/** Live list of favorite tools (resolved against the registry) and a toggle. */
export function useFavoriteTools() {
  const rows = useLiveQuery(() => favoritesRepository.list('tool'), []);
  const ids = useMemo(() => rows?.map((r) => r.entityId) ?? [], [rows]);
  const idSet = useMemo(() => new Set(ids), [ids]);
  const tools: ToolDefinition[] = useMemo(() => resolveTools(ids), [ids]);

  const toggle = useCallback((toolId: string) => favoritesRepository.toggle('tool', toolId), []);
  const isFavorite = useCallback((toolId: string) => idSet.has(toolId), [idSet]);

  return { tools, isFavorite, toggle, loading: rows === undefined };
}
