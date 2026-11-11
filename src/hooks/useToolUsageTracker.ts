import { useEffect } from 'react';
import { toolUsageRepository } from '@/services/db/repositories';
import { usePreferencesStore } from '@/stores/preferencesStore';

/**
 * Records that a tool was opened: updates the recent-tools list
 * (localStorage) and usage counters (IndexedDB) for dashboard statistics.
 */
export function useToolUsageTracker(toolId: string | undefined): void {
  const pushRecentTool = usePreferencesStore((s) => s.pushRecentTool);
  useEffect(() => {
    if (!toolId) return;
    pushRecentTool(toolId);
    toolUsageRepository.recordUse(toolId).catch((error: unknown) => {
      // Usage stats are best-effort; never block the tool.
      console.warn('Could not record tool usage', error);
    });
  }, [toolId, pushRecentTool]);
}
