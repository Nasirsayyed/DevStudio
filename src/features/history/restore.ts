import type { SqlDialect } from '@/types/entities';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';

type Restorer = (input: string, options: Record<string, unknown>) => void;

const DIALECTS: readonly SqlDialect[] = ['mssql', 'postgresql', 'mysql', 'sqlite'];

const json = (input: string) => {
  useJsonWorkspaceStore.getState().loadDocument(input, null);
};
const jsonField = (field: 'csv' | 'xml') => (input: string) => {
  useJsonWorkspaceStore.setState({ [field]: input });
};
const text = (field: 'text' | 'markdown' | 'html' | 'yaml') => (input: string) => {
  useTextWorkspaceStore.getState().set({ [field]: input });
};
const sql = (field: 'sql' | 'schema') => (input: string, options: Record<string, unknown>) => {
  const dialect = DIALECTS.find((d) => d === options.dialect);
  useSqlWorkspaceStore.getState().set({ [field]: input, ...(dialect ? { dialect } : {}) });
};

/** Tools whose input lives in a shared workspace store, so a history entry can be reopened. */
function restorerFor(toolId: string): Restorer | null {
  const [moduleId, slug = ''] = toolId.split('.');
  switch (moduleId) {
    case 'json':
      return slug === 'from-csv' ? jsonField('csv') : json;
    case 'codegen':
      return slug === 'xml-to-json' ? jsonField('xml') : json;
    case 'text':
      if (slug === 'xml-formatter') return jsonField('xml');
      if (slug === 'markdown-preview') return text('markdown');
      if (slug === 'html-preview') return text('html');
      if (slug === 'yaml-formatter') return text('yaml');
      if (slug === 'text-diff' || slug === 'code-diff') return null;
      return text('text');
    case 'sql':
      if (['formatter', 'minifier', 'validator'].includes(slug)) return sql('sql');
      if (['to-csharp', 'to-typescript'].includes(slug)) return sql('schema');
      return null;
    default:
      return null;
  }
}

export function canRestore(toolId: string, input: string): boolean {
  return input.trim() !== '' && restorerFor(toolId) !== null;
}

/** Puts the entry's input back into the tool's workspace (call, then navigate to the tool). */
export function restoreInput(
  toolId: string,
  input: string,
  options: Record<string, unknown>,
): boolean {
  const restore = restorerFor(toolId);
  if (!restore || !input.trim()) return false;
  restore(input, options);
  return true;
}
