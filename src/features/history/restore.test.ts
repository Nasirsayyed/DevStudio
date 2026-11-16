import { beforeEach, describe, expect, it } from 'vitest';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';
import { useTextWorkspaceStore } from '@/stores/textWorkspaceStore';
import { resetAppState } from '@/test/renderApp';
import { canRestore, restoreInput } from './restore';

beforeEach(async () => {
  await resetAppState();
});

describe('history restore mapping', () => {
  it.each([
    ['json.formatter', () => useJsonWorkspaceStore.getState().input],
    ['json.from-csv', () => useJsonWorkspaceStore.getState().csv],
    ['codegen.csharp', () => useJsonWorkspaceStore.getState().input],
    ['codegen.xml-to-json', () => useJsonWorkspaceStore.getState().xml],
    ['text.xml-formatter', () => useJsonWorkspaceStore.getState().xml],
    ['text.markdown-preview', () => useTextWorkspaceStore.getState().markdown],
    ['text.html-preview', () => useTextWorkspaceStore.getState().html],
    ['text.yaml-formatter', () => useTextWorkspaceStore.getState().yaml],
    ['text.case-converter', () => useTextWorkspaceStore.getState().text],
    ['sql.minifier', () => useSqlWorkspaceStore.getState().sql],
    ['sql.to-typescript', () => useSqlWorkspaceStore.getState().schema],
  ])('%s restores into its workspace', (toolId, read) => {
    expect(canRestore(toolId, 'value')).toBe(true);
    expect(restoreInput(toolId, 'value', {})).toBe(true);
    expect(read()).toBe('value');
  });

  it('restores the SQL dialect only when it is valid', () => {
    restoreInput('sql.formatter', 'select 1', { dialect: 'mssql' });
    expect(useSqlWorkspaceStore.getState().dialect).toBe('mssql');
    restoreInput('sql.formatter', 'select 2', { dialect: 'oracle' });
    expect(useSqlWorkspaceStore.getState()).toMatchObject({ sql: 'select 2', dialect: 'mssql' });
  });

  it('refuses tools without a shared input and empty inputs', () => {
    for (const id of [
      'utils.uuid',
      'text.text-diff',
      'sql.query-generator',
      'api.requests',
      'unknown',
    ])
      expect(canRestore(id, 'x'), id).toBe(false);
    expect(canRestore('json.formatter', '   ')).toBe(false);
    expect(restoreInput('utils.uuid', 'x', {})).toBe(false);
  });
});
