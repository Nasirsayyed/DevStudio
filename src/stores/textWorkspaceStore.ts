import { z } from 'zod';
import { create } from 'zustand';
import { createDraftPersistence, fitDraft } from './draftPersistence';

/**
 * Working text shared by the Text Tools, so switching between the find & replace, counter, line,
 * reverse and case tools keeps your text. Drafts survive reloads (IndexedDB, local only).
 * (XML is shared with XML → JSON through the JSON workspace.)
 */
export interface TextWorkspaceState {
  text: string;
  diffLeft: string;
  diffRight: string;
  codeLeft: string;
  codeRight: string;
  markdown: string;
  html: string;
  yaml: string;
  set: (patch: Partial<Omit<TextWorkspaceState, 'set'>>) => void;
}

const EMPTY = {
  text: '',
  diffLeft: '',
  diffRight: '',
  codeLeft: '',
  codeRight: '',
  markdown: '',
  html: '',
  yaml: '',
};

export const useTextWorkspaceStore = create<TextWorkspaceState>()((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
}));

export const TEXT_DRAFT_SETTING_KEY = 'textTools.draft';

const draftSchema = z.object({
  text: z.string().default(''),
  diffLeft: z.string().default(''),
  diffRight: z.string().default(''),
  codeLeft: z.string().default(''),
  codeRight: z.string().default(''),
  markdown: z.string().default(''),
  html: z.string().default(''),
  yaml: z.string().default(''),
});
type Draft = z.infer<typeof draftSchema>;
const FIELDS = Object.keys(EMPTY) as (keyof Draft)[];

const drafts = createDraftPersistence<TextWorkspaceState, Draft>({
  store: useTextWorkspaceStore,
  key: TEXT_DRAFT_SETTING_KEY,
  schema: draftSchema,
  empty: EMPTY,
  label: 'Text Tools',
  select: (s) => Object.fromEntries(FIELDS.map((k) => [k, fitDraft(s[k])])) as Draft,
  restore: (s, draft) => Object.fromEntries(FIELDS.map((k) => [k, s[k] || draft[k]])),
});

export function hydrateTextWorkspaceDraft(): Promise<void> {
  return drafts.hydrate();
}

/** Test helper. */
export function resetTextWorkspaceState(): void {
  drafts.reset();
  useTextWorkspaceStore.setState(EMPTY);
}
