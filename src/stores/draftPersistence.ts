import type { z } from 'zod';
import type { StoreApi } from 'zustand';
import { settingsRepository } from '@/services/db/repositories';

/** Inputs larger than this are not kept as drafts (save them as documents instead). */
export const MAX_DRAFT_CHARS = 5_000_000;
const DRAFT_DEBOUNCE_MS = 800;

export interface DraftPersistence {
  /**
   * Restores the last draft once per session (only into empty fields, so it never overwrites
   * newer work) and saves later changes, debounced. Changes made while the draft is still
   * loading are saved once loading completes.
   */
  hydrate(): Promise<void>;
  /** Writes a pending (debounced) change now; resolves when it is stored. */
  flush(): Promise<void>;
  /** Test helper: forgets hydration state and pending saves. */
  reset(): void;
}

/** Drops strings that are too large to keep as a draft. */
export function fitDraft(text: string): string {
  return text.length > MAX_DRAFT_CHARS ? '' : text;
}

/**
 * Keeps the working inputs of a store in IndexedDB (settings table) so they survive reloads.
 * `select` picks the persisted fields; `restore` merges a loaded draft into the current state.
 */
export function createDraftPersistence<S, D extends object>(config: {
  store: StoreApi<S>;
  key: string;
  schema: z.ZodType<D>;
  empty: D;
  select: (state: S) => D;
  restore: (state: S, draft: D) => Partial<S>;
  label: string;
}): DraftPersistence {
  const { store, key, schema, empty, select, restore, label } = config;
  let hydration: Promise<void> | null = null;
  let hydrated = false;
  let pendingSave = false;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const changed = (a: D, b: D) =>
    (Object.keys(a) as (keyof D)[]).some((k) => !Object.is(a[k], b[k]));

  const saveNow = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    return settingsRepository.set(key, select(store.getState())).catch((error: unknown) => {
      console.warn(`Could not save the ${label} draft`, error);
    });
  };
  const saveSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void saveNow(), DRAFT_DEBOUNCE_MS);
  };
  // A reload or tab switch right after a change must not lose it: write pending drafts at once.
  const flush = (): Promise<void> => (timer !== undefined ? saveNow() : Promise.resolve());
  const onPageHide = () => {
    void flush();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  let listening = false;

  return {
    flush,
    hydrate() {
      if (!listening && typeof window !== 'undefined') {
        listening = true;
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('visibilitychange', onVisibility);
      }
      unsubscribe ??= store.subscribe((state, prev) => {
        if (!changed(select(state), select(prev))) return;
        if (hydrated) saveSoon();
        else pendingSave = true;
      });
      hydration ??= settingsRepository
        .get(key, schema, empty)
        .then((draft) => {
          store.setState(restore(store.getState(), draft));
        })
        .catch((error: unknown) => {
          console.warn(`Could not restore the ${label} draft`, error);
        })
        .finally(() => {
          hydrated = true;
          if (pendingSave) {
            pendingSave = false;
            saveSoon();
          }
        });
      return hydration;
    },
    reset() {
      unsubscribe?.();
      unsubscribe = null;
      hydration = null;
      hydrated = false;
      pendingSave = false;
      clearTimeout(timer);
      timer = undefined;
      if (listening) {
        listening = false;
        window.removeEventListener('pagehide', onPageHide);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    },
  };
}
