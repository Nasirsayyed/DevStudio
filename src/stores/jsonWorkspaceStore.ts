import { z } from 'zod';
import { create } from 'zustand';
import { createDraftPersistence, fitDraft, MAX_DRAFT_CHARS } from './draftPersistence';

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
  /** XML input of the XML → JSON tool. */
  xml: string;
  /** Saved document currently loaded in `input`, if any. */
  document: OpenDocument | null;
  setInput: (input: string) => void;
  setSecondary: (secondary: string) => void;
  setCsv: (csv: string) => void;
  setXml: (xml: string) => void;
  /** Replaces the input with a saved document (or plain text when doc is null). */
  loadDocument: (content: string, doc: OpenDocument | null) => void;
  setDocument: (doc: OpenDocument | null) => void;
}

export const useJsonWorkspaceStore = create<JsonStudioState>()((set) => ({
  input: '',
  secondary: '',
  csv: '',
  xml: '',
  document: null,
  setInput: (input) => set({ input }),
  setSecondary: (secondary) => set({ secondary }),
  setCsv: (csv) => set({ csv }),
  setXml: (xml) => set({ xml }),
  loadDocument: (content, document) => set({ input: content, document }),
  setDocument: (document) => set({ document }),
}));

/* ------------------------------------------------------------------------ */
/* Draft persistence: working inputs survive reloads (IndexedDB, local only). */
/* ------------------------------------------------------------------------ */

export const DRAFT_SETTING_KEY = 'jsonStudio.draft';
export { MAX_DRAFT_CHARS };

const draftSchema = z.object({
  input: z.string(),
  secondary: z.string(),
  csv: z.string(),
  // Added in v0.3; older drafts don't have it.
  xml: z.string().default(''),
  document: z.object({ id: z.string(), name: z.string() }).nullable(),
});
type Draft = z.infer<typeof draftSchema>;

const drafts = createDraftPersistence<JsonStudioState, Draft>({
  store: useJsonWorkspaceStore,
  key: DRAFT_SETTING_KEY,
  schema: draftSchema,
  empty: { input: '', secondary: '', csv: '', xml: '', document: null },
  label: 'JSON Studio',
  select: (s) => ({
    input: fitDraft(s.input),
    secondary: fitDraft(s.secondary),
    csv: fitDraft(s.csv),
    xml: fitDraft(s.xml),
    document: s.document,
  }),
  restore: (s, draft) => ({
    input: s.input || draft.input,
    secondary: s.secondary || draft.secondary,
    csv: s.csv || draft.csv,
    xml: s.xml || draft.xml,
    document: s.input ? s.document : draft.document,
  }),
});

/** Restores the JSON workspace draft once per session and keeps saving changes. */
export function hydrateJsonWorkspaceDraft(): Promise<void> {
  return drafts.hydrate();
}

/** Test helper: forget hydration state, pending saves and in-memory inputs. */
export function resetJsonWorkspaceState(): void {
  drafts.reset();
  useJsonWorkspaceStore.setState({ input: '', secondary: '', csv: '', xml: '', document: null });
}
