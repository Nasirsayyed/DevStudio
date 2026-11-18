import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  MAX_RECENT_TOOLS,
  PREFERENCES_STORAGE_KEY,
  loadPreferences,
  savePreferences,
} from './preferences';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => {
      data.delete(k);
    },
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe('preferences service', () => {
  it('returns defaults when nothing is stored or storage is unavailable', () => {
    expect(loadPreferences(memoryStorage())).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips saved preferences', () => {
    const storage = memoryStorage();
    const prefs = {
      ...DEFAULT_PREFERENCES,
      themeMode: 'dark' as const,
      sidebarCollapsed: true,
      recentToolIds: ['json.formatter'],
    };
    expect(savePreferences(prefs, storage)).toBe(true);
    expect(loadPreferences(storage)).toEqual(prefs);
  });

  it('falls back per field when stored values are invalid', () => {
    const storage = memoryStorage({
      [PREFERENCES_STORAGE_KEY]: JSON.stringify({
        themeMode: 'neon',
        sidebarCollapsed: 'yes',
        editor: { fontSize: 99, tabSize: 3, wordWrap: false },
        recentToolIds: 'not-an-array',
      }),
    });
    const prefs = loadPreferences(storage);
    expect(prefs.themeMode).toBe('system');
    expect(prefs.sidebarCollapsed).toBe(false);
    expect(prefs.editor).toEqual({ fontSize: 14, tabSize: 2, wordWrap: false, minimap: false });
    expect(prefs.recentToolIds).toEqual([]);
  });

  it('returns defaults for corrupted JSON', () => {
    expect(loadPreferences(memoryStorage({ [PREFERENCES_STORAGE_KEY]: '{oops' }))).toEqual(
      DEFAULT_PREFERENCES,
    );
  });

  it('ignores prototype pollution payloads', () => {
    const storage = memoryStorage({
      [PREFERENCES_STORAGE_KEY]: '{"__proto__":{"polluted":1},"themeMode":"light"}',
    });
    expect(loadPreferences(storage).themeMode).toBe('light');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('dedupes and caps recent tools', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `t${i % 15}`);
    const storage = memoryStorage({
      [PREFERENCES_STORAGE_KEY]: JSON.stringify({ recentToolIds: ids }),
    });
    const recent = loadPreferences(storage).recentToolIds;
    expect(recent).toHaveLength(MAX_RECENT_TOOLS);
    expect(new Set(recent).size).toBe(recent.length);
  });

  it('reports failure when storage throws (e.g. quota exceeded)', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(savePreferences(DEFAULT_PREFERENCES, storage)).toBe(false);
  });
});
