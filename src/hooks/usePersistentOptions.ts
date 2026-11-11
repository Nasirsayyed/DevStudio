import { useCallback, useState } from 'react';
import { safeJsonParse } from '@/core/security/safeJsonParse';

const PREFIX = 'devstudio:options:';

function load<T extends Record<string, unknown>>(key: string, defaults: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return defaults;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
    const stored = parsed as Record<string, unknown>;
    const out: Record<string, unknown> = { ...defaults };
    // Only accept known keys whose type matches the default.
    for (const k of Object.keys(defaults)) {
      if (k in stored && typeof stored[k] === typeof defaults[k]) out[k] = stored[k];
    }
    return out as T;
  } catch {
    return defaults;
  }
}

/**
 * Small per-tool options object remembered in localStorage (a per-browser
 * convenience; invalid or unknown stored fields fall back to defaults).
 */
export function usePersistentOptions<T extends Record<string, unknown>>(key: string, defaults: T) {
  const [options, setOptions] = useState<T>(() => load(key, defaults));
  const update = useCallback(
    (patch: Partial<T>) => {
      setOptions((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(PREFIX + key, JSON.stringify(next));
        } catch {
          // Not remembered; still applied for this session.
        }
        return next;
      });
    },
    [key],
  );
  return [options, update] as const;
}
