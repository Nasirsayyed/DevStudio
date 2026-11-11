import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { settingsRepository } from '@/services/db/repositories';
import { getTool } from '@/tools/toolRegistry';

/** Settings key for the user's customized dashboard quick-access tools. */
export const QUICK_ACCESS_SETTING_KEY = 'dashboard.quickAccess';
export const MAX_QUICK_ACCESS = 9;

export const DEFAULT_QUICK_ACCESS: readonly string[] = [
  'api.requests',
  'json.formatter',
  'codegen.csharp',
  'codegen.typescript',
  'sql.formatter',
  'utils.jwt-decoder',
  'utils.base64',
  'text.text-diff',
];

const quickAccessSchema = z.array(z.string()).max(MAX_QUICK_ACCESS);

export function loadQuickAccess(): Promise<string[]> {
  return settingsRepository
    .get(QUICK_ACCESS_SETTING_KEY, quickAccessSchema, [...DEFAULT_QUICK_ACCESS])
    .then((ids) => ids.filter((id) => getTool(id) !== undefined));
}

export function saveQuickAccess(ids: readonly string[]): Promise<void> {
  return settingsRepository.set(QUICK_ACCESS_SETTING_KEY, ids.slice(0, MAX_QUICK_ACCESS));
}

/** Live quick-access tool ids (undefined while loading). */
export function useQuickAccessIds(): string[] | undefined {
  return useLiveQuery(loadQuickAccess, []);
}
