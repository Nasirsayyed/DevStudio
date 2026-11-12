import { z } from 'zod';
import { create } from 'zustand';
import type { SqlDialect } from '@/types/entities';
import { createDraftPersistence, fitDraft } from './draftPersistence';

export interface OpenQuery {
  id: string;
  name: string;
}

/**
 * Working state shared by the SQL tools: the script (formatter, minifier, validator, compare
 * left side), the compare right side, the CREATE TABLE schema (code and statement generators),
 * INSERT data and the dialect. Drafts survive reloads (IndexedDB, local only).
 */
export interface SqlWorkspaceState {
  sql: string;
  right: string;
  schema: string;
  data: string;
  dialect: SqlDialect;
  /** Saved query loaded in `sql`, if any. */
  query: OpenQuery | null;
  set: (patch: Partial<Omit<SqlWorkspaceState, 'set'>>) => void;
}

const EMPTY = {
  sql: '',
  right: '',
  schema: '',
  data: '',
  dialect: 'postgresql' as SqlDialect,
  query: null,
};

export const useSqlWorkspaceStore = create<SqlWorkspaceState>()((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
}));

export const SQL_DRAFT_SETTING_KEY = 'sqlTools.draft';

const draftSchema = z.object({
  sql: z.string().default(''),
  right: z.string().default(''),
  schema: z.string().default(''),
  data: z.string().default(''),
  dialect: z.enum(['mssql', 'postgresql', 'mysql', 'sqlite']).default('postgresql'),
  query: z.object({ id: z.string(), name: z.string() }).nullable().default(null),
});
type Draft = z.infer<typeof draftSchema>;

const drafts = createDraftPersistence<SqlWorkspaceState, Draft>({
  store: useSqlWorkspaceStore,
  key: SQL_DRAFT_SETTING_KEY,
  schema: draftSchema,
  empty: EMPTY,
  label: 'SQL Tools',
  select: (s) => ({
    sql: fitDraft(s.sql),
    right: fitDraft(s.right),
    schema: fitDraft(s.schema),
    data: fitDraft(s.data),
    dialect: s.dialect,
    query: s.query,
  }),
  restore: (s, d) => ({
    sql: s.sql || d.sql,
    right: s.right || d.right,
    schema: s.schema || d.schema,
    data: s.data || d.data,
    // A dialect chosen this session wins over the draft's.
    dialect: s.dialect === EMPTY.dialect ? d.dialect : s.dialect,
    query: s.sql ? s.query : d.query,
  }),
});

export function hydrateSqlWorkspaceDraft(): Promise<void> {
  return drafts.hydrate();
}

export function resetSqlWorkspaceState(): void {
  drafts.reset();
  useSqlWorkspaceStore.setState(EMPTY);
}
