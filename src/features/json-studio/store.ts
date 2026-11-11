import { z } from 'zod';
import { create } from 'zustand';
import { settingsRepository } from '@/services/db/repositories';

export interface OpenDocument {
  id: string;
  name: string;
}

/**
 * Working state shared by all JSON Studio tools, so switching tools keeps
 * the current document. Kept in memory for the session only (documents are
 * persisted explicitly via "Save").
 */
interface JsonStudioState {
  /** Main JSON input (also: compare left side, schema-validator data). */
  input: string;
  /** Second JSON input (compare right side, JSON Schema). */
  secondary: string;
  /** CSV input of the CSV → JSON tool. */
  csv: string;
  /** Saved document currently loaded in `input`, if any. */
  document: OpenDocument | null;
  setInput: (input: string) => void;
  setSecondary: (secondary: string) => void;
  setCsv: (csv: string) => void;
  /** Replaces the input with a saved document (or plain text when doc is null). */
  loadDocument: (content: string, doc: OpenDocument | null) => void;
  setDocument: (doc: OpenDocument | null) => void;
}

export const useJsonStudioStore = create<JsonStudioState>()((set) => ({
  input: '',
  secondary: '',
  csv: '',
  document: null,
  setInput: (input) => set({ input }),
  setSecondary: (secondary) => set({ secondary }),
  setCsv: (csv) => set({ csv }),
  loadDocument: (content, document) => set({ input: content, document }),
  setDocument: (document) => set({ document }),
}));

/* ------------------------------------------------------------------------ */
/* Draft persistence: working inputs survive reloads (IndexedDB, local only). */
/* ------------------------------------------------------------------------ */

export const DRAFT_SETTING_KEY = 'jsonStudio.draft';
/** Inputs larger than this are not kept as drafts (save them as documents instead). */
export const MAX_DRAFT_CHARS = 5_000_000;
const DRAFT_DEBOUNCE_MS = 800;

const draftSchema = z.object({
  input: z.string(),
  secondary: z.string(),
  csv: z.string(),
  document: z.object({ id: z.string(), name: z.string() }).nullable(),
});
type Draft = z.infer<typeof draftSchema>;

const EMPTY_DRAFT: Draft = { input: '', secondary: '', csv: '', document: null };

let hydration: Promise<void> | null = null;
let hydrated = false;
let pendingSave = false;
let unsubscribe: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function fit(text: string): string {
  return text.length > MAX_DRAFT_CHARS ? '' : text;
}

function saveDraftSoon(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { input, secondary, csv, document } = useJsonStudioStore.getState();
    settingsRepository
      .set(DRAFT_SETTING_KEY, {
        input: fit(input),
        secondary: fit(secondary),
        csv: fit(csv),
        document,
      })
      .catch((error: unknown) => {
        console.warn('Could not save JSON Studio draft', error);
      });
  }, DRAFT_DEBOUNCE_MS);
}

/**
 * Restores the last draft once per session (only into empty fields, so it
 * never overwrites newer work) and saves changes, debounced. Changes made
 * while the draft is still loading are saved once loading completes.
 */
export function hydrateJsonStudioDraft(): Promise<void> {
  unsubscribe ??= useJsonStudioStore.subscribe((state, prev) => {
    if (
      state.input === prev.input &&
      state.secondary === prev.secondary &&
      state.csv === prev.csv &&
      state.document === prev.document
    )
      return;
    if (hydrated) saveDraftSoon();
    else pendingSave = true;
  });
  hydration ??= settingsRepository
    .get(DRAFT_SETTING_KEY, draftSchema, EMPTY_DRAFT)
    .then((draft) => {
      const s = useJsonStudioStore.getState();
      useJsonStudioStore.setState({
        input: s.input || draft.input,
        secondary: s.secondary || draft.secondary,
        csv: s.csv || draft.csv,
        document: s.input ? s.document : draft.document,
      });
    })
    .catch((error: unknown) => {
      console.warn('Could not restore JSON Studio draft', error);
    })
    .finally(() => {
      hydrated = true;
      if (pendingSave) {
        pendingSave = false;
        saveDraftSoon();
      }
    });
  return hydration;
}

/** Test helper: forget hydration state, pending saves and in-memory inputs. */
export function resetJsonStudioState(): void {
  unsubscribe?.();
  unsubscribe = null;
  hydration = null;
  hydrated = false;
  pendingSave = false;
  clearTimeout(saveTimer);
  useJsonStudioStore.setState({ input: '', secondary: '', csv: '', document: null });
}
