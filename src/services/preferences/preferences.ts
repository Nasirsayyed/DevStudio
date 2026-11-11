import { z } from 'zod';
import { safeJsonParse } from '@/core/security/safeJsonParse';

/**
 * Lightweight user preferences persisted in localStorage.
 * Only non-sensitive UI preferences belong here (see docs/DATABASE_SCHEMA.md).
 */
export const PREFERENCES_STORAGE_KEY = 'devstudio:prefs:v1';
export const MAX_RECENT_TOOLS = 10;

export const themeModeSchema = z.enum(['light', 'dark', 'system']);
export type ThemeMode = z.infer<typeof themeModeSchema>;

export const editorPreferencesSchema = z.object({
  fontSize: z.number().int().min(10).max(28).catch(14),
  tabSize: z.union([z.literal(2), z.literal(4), z.literal(8)]).catch(2),
  wordWrap: z.boolean().catch(true),
  minimap: z.boolean().catch(false),
});
export type EditorPreferences = z.infer<typeof editorPreferencesSchema>;

export const preferencesSchema = z.object({
  themeMode: themeModeSchema.catch('system'),
  sidebarCollapsed: z.boolean().catch(false),
  selectedEnvironmentId: z.string().nullable().catch(null),
  editor: editorPreferencesSchema.catch(() => DEFAULT_EDITOR_PREFERENCES),
  recentToolIds: z
    .array(z.string().max(100))
    .catch([])
    .transform((ids) => [...new Set(ids)].slice(0, MAX_RECENT_TOOLS)),
});
export type Preferences = z.infer<typeof preferencesSchema>;

const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
};

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  sidebarCollapsed: false,
  selectedEnvironmentId: null,
  editor: DEFAULT_EDITOR_PREFERENCES,
  recentToolIds: [],
};

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Access can throw (privacy mode, blocked site data).
    return null;
  }
}

/** Loads preferences; any invalid field falls back to its default individually. */
export function loadPreferences(storage: Storage | null = getStorage()): Preferences {
  if (!storage) return DEFAULT_PREFERENCES;
  try {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = preferencesSchema.safeParse({
      ...DEFAULT_PREFERENCES,
      ...(safeJsonParse(raw) as object),
    });
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Saves preferences. Returns false if storage is unavailable or full. */
export function savePreferences(
  prefs: Preferences,
  storage: Storage | null = getStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
