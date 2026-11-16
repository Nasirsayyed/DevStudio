import { z } from 'zod';
import { create } from 'zustand';
import {
  emptyRequest,
  parseRequestDraft,
  type RequestDraft,
  withoutCredentials,
} from '@/core/http/model';
import { createDraftPersistence } from './draftPersistence';

export interface OpenRequestRef {
  id: string;
  collectionId: string | null;
  folderId: string | null;
}

/**
 * The request open in the Request Builder. The draft is kept across reloads WITHOUT credentials;
 * files chosen for form-data/binary bodies and runtime variables stay in memory.
 */
export interface ApiWorkspaceState {
  draft: RequestDraft;
  /** Saved request the draft came from (null = not saved yet). */
  open: OpenRequestRef | null;
  /** The draft differs from the saved request. */
  dirty: boolean;
  /** Values extracted from responses (runner and chained requests); memory only. */
  runtime: Record<string, string>;
  /** Files for form-data entries (by entry id) and the binary body. */
  files: Record<string, File>;
  binaryFile: File | null;
  setDraft: (draft: RequestDraft, dirty?: boolean) => void;
  update: (patch: Partial<RequestDraft>) => void;
  load: (draft: RequestDraft, open: OpenRequestRef | null) => void;
  set: (
    patch: Partial<Pick<ApiWorkspaceState, 'runtime' | 'files' | 'binaryFile' | 'open' | 'dirty'>>,
  ) => void;
}

const initial = () => ({
  draft: emptyRequest(),
  open: null,
  dirty: false,
  runtime: {},
  files: {},
  binaryFile: null,
});

export const useApiWorkspaceStore = create<ApiWorkspaceState>()((set) => ({
  ...initial(),
  setDraft: (draft, dirty = true) => set({ draft, dirty }),
  update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch }, dirty: true })),
  load: (draft, open) => set({ draft, open, dirty: false, files: {}, binaryFile: null }),
  set: (patch) => set(patch),
}));

export const API_DRAFT_SETTING_KEY = 'apiStudio.draft';

const draftSchema = z.object({
  draft: z.unknown(),
  open: z
    .object({
      id: z.string(),
      collectionId: z.string().nullable(),
      folderId: z.string().nullable(),
    })
    .nullable()
    .catch(null),
  dirty: z.boolean().catch(false),
});
type Draft = { draft: unknown; open: OpenRequestRef | null; dirty: boolean };

const drafts = createDraftPersistence<ApiWorkspaceState, Draft>({
  store: useApiWorkspaceStore,
  key: API_DRAFT_SETTING_KEY,
  schema: draftSchema,
  empty: { draft: null, open: null, dirty: false },
  label: 'API Studio',
  // Credentials never reach IndexedDB through the draft.
  select: (s) => ({ draft: withoutCredentials(s.draft), open: s.open, dirty: s.dirty }),
  restore: (s, d) => {
    if (s.dirty || s.open || d.draft === null) return {};
    try {
      return { draft: parseRequestDraft(d.draft), open: d.open, dirty: d.dirty };
    } catch {
      return {};
    }
  },
});

export function hydrateApiWorkspaceDraft(): Promise<void> {
  return drafts.hydrate();
}

/** Stores the current draft now (e.g. right after saving, before a quick reload). */
export function flushApiWorkspaceDraft(): Promise<void> {
  return drafts.flush();
}

export function resetApiWorkspaceState(): void {
  drafts.reset();
  useApiWorkspaceStore.setState(initial());
}
