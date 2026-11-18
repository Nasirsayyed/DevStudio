import { describe, expect, it } from 'vitest';
import { MODULES, findModuleByPath, getModule } from './modules';
import {
  CANONICAL_TOOLS,
  TOOLS,
  getTool,
  getToolBySlug,
  getToolsByModule,
  resolveTools,
  toolPath,
} from './toolRegistry';

describe('module registry', () => {
  it('contains the required sidebar modules in order', () => {
    expect(MODULES.map((m) => m.title)).toEqual([
      'Dashboard',
      'API Testing',
      'JSON Studio',
      'Code Generators',
      'SQL Tools',
      'Developer Utilities',
      'Text Tools',
      'Snippet Manager',
      'History',
      'Favorites',
      'Settings',
    ]);
  });

  it('has unique ids and paths', () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.path)).size).toBe(MODULES.length);
  });

  it('resolves modules from paths', () => {
    expect(findModuleByPath('/')?.id).toBe('dashboard');
    expect(findModuleByPath('/json/formatter')?.id).toBe('json');
    expect(findModuleByPath('/settings')?.id).toBe('settings');
    expect(findModuleByPath('/nope')).toBeUndefined();
    expect(() => getModule('missing' as never)).toThrow();
  });
});

describe('tool registry', () => {
  it('has unique, well-formed ids that match module + slug', () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOOLS) {
      expect(t.id).toBe(`${t.moduleId}.${t.slug}`);
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.description.length).toBeGreaterThan(10);
      expect(getModule(t.moduleId).hasTools).toBe(true);
      expect(t.phase).toBeGreaterThanOrEqual(3);
      expect(t.phase).toBeLessThanOrEqual(13);
    }
  });

  it('aliases point to existing canonical tools', () => {
    const aliases = TOOLS.filter((t) => t.aliasOf);
    expect(aliases.length).toBeGreaterThan(0);
    for (const a of aliases) {
      const target = getTool(a.aliasOf ?? '');
      expect(target).toBeDefined();
      expect(target?.aliasOf).toBeUndefined();
    }
    expect(CANONICAL_TOOLS.length).toBe(TOOLS.length - aliases.length);
  });

  it('covers the tools required by the specification', () => {
    for (const id of [
      'json.formatter',
      'json.validator',
      'json.compare',
      'json.jsonpath',
      'json.schema-generator',
      'json.to-csv',
      'json.from-csv',
      'codegen.csharp',
      'codegen.typescript',
      'codegen.java',
      'codegen.python',
      'codegen.sql-table',
      'codegen.xml-to-json',
      'sql.formatter',
      'sql.validator',
      'sql.schema-designer',
      'sql.playground',
      'utils.base64',
      'utils.jwt-decoder',
      'utils.jwt-verify',
      'utils.uuid',
      'utils.hash',
      'utils.cron',
      'utils.user-agent',
      'text.text-diff',
      'text.markdown-preview',
      'text.yaml-formatter',
      'api.requests',
      'api.environments',
    ]) {
      expect(getTool(id), id).toBeDefined();
    }
  });

  it('builds paths and lookups', () => {
    const tool = getToolBySlug('json', 'formatter');
    expect(tool && toolPath(tool)).toBe('/json/formatter');
    expect(getToolsByModule('utils').every((t) => t.moduleId === 'utils')).toBe(true);
    expect(resolveTools(['json.formatter', 'removed.tool', 'utils.uuid']).map((t) => t.id)).toEqual(
      ['json.formatter', 'utils.uuid'],
    );
  });
});
