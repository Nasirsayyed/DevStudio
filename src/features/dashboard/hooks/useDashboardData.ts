import { useLiveQuery } from 'dexie-react-hooks';
import { toolUsageRepository, workspaceRepository } from '@/services/db/repositories';

const RECENT_LIMIT = 5;
const TOP_TOOLS_LIMIT = 8;

/**
 * All dashboard data, derived from local IndexedDB data via live queries
 * (re-renders automatically when the underlying tables change).
 */
export function useDashboardData() {
  const counts = useLiveQuery(() => workspaceRepository.counts(), []);
  const recentRequests = useLiveQuery(() => workspaceRepository.recentApiHistory(RECENT_LIMIT), []);
  const recentDocuments = useLiveQuery(
    () => workspaceRepository.recentJsonDocuments(RECENT_LIMIT),
    [],
  );
  const recentSnippets = useLiveQuery(() => workspaceRepository.recentSnippets(RECENT_LIMIT), []);
  const topTools = useLiveQuery(() => toolUsageRepository.top(TOP_TOOLS_LIMIT), []);
  const totalUses = useLiveQuery(() => toolUsageRepository.totalUses(), []);
  return { counts, recentRequests, recentDocuments, recentSnippets, topTools, totalUses };
}
