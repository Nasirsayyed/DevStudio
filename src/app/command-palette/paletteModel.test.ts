import { describe, expect, it, vi } from 'vitest';
import type { EntitySearchResult } from '@/services/db/repositories';
import {
  type PaletteAction,
  buildPaletteGroups,
  entityPath,
  parsePaletteQuery,
} from './paletteModel';

const actions: PaletteAction[] = [
  { id: 'theme:dark', title: 'Switch to dark theme', keywords: ['theme'], run: vi.fn() },
  { id: 'sidebar', title: 'Toggle sidebar', keywords: ['layout'], run: vi.fn() },
];

const snippet: EntitySearchResult = {
  kind: 'snippet',
  id: 's1',
  title: 'JSON helper',
  subtitle: 'ts',
  updatedAt: 1,
};

describe('parsePaletteQuery', () => {
  it('detects the action prefix', () => {
    expect(parsePaletteQuery('> theme')).toEqual({ actionsOnly: true, text: 'theme' });
    expect(parsePaletteQuery('  json ')).toEqual({ actionsOnly: false, text: 'json' });
  });
});

describe('buildPaletteGroups', () => {
  it('shows recent tools and actions for an empty query', () => {
    const groups = buildPaletteGroups({
      query: '',
      actions,
      recentToolIds: ['json.formatter', 'gone.tool'],
      entities: [],
    });
    expect(groups.map((g) => g.id)).toEqual(['recent', 'actions']);
    expect(groups[0]?.items).toHaveLength(1);
  });

  it('omits the recent group when there are no recent tools', () => {
    const groups = buildPaletteGroups({ query: '', actions, recentToolIds: [], entities: [] });
    expect(groups.map((g) => g.id)).toEqual(['actions']);
  });

  it('groups tools, entities and matching actions for a query', () => {
    const groups = buildPaletteGroups({
      query: 'json',
      actions,
      recentToolIds: [],
      entities: [snippet],
    });
    expect(groups.map((g) => g.id)).toEqual(['tools', 'snippet']);
    const first = groups[0]?.items[0];
    expect(first?.type === 'tool' && first.tool.moduleId).toBe('json');
  });

  it('ranks recently used tools higher among similar matches', () => {
    const without = buildPaletteGroups({ query: 'json', actions, recentToolIds: [], entities: [] });
    const withRecent = buildPaletteGroups({
      query: 'json',
      actions,
      recentToolIds: ['json.formatter'],
      entities: [],
    });
    const firstId = (g: typeof without) => {
      const item = g[0]?.items[0];
      return item?.type === 'tool' ? item.tool.id : undefined;
    };
    expect(firstId(without)).not.toBe('json.formatter');
    expect(firstId(withRecent)).toBe('json.formatter');
  });

  it('never lists alias tools (no duplicate results)', () => {
    const groups = buildPaletteGroups({
      query: 'json to csv',
      actions,
      recentToolIds: [],
      entities: [],
    });
    const ids = groups.flatMap((g) => g.items).map((i) => (i.type === 'tool' ? i.tool.id : i.key));
    expect(ids).toContain('json.to-csv');
    expect(ids).not.toContain('codegen.json-to-csv');
  });

  it('shows only actions with the ">" prefix', () => {
    const groups = buildPaletteGroups({
      query: '>theme',
      actions,
      recentToolIds: ['json.formatter'],
      entities: [snippet],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.key)).toEqual(['action:theme:dark']);
  });

  it('returns no groups when nothing matches', () => {
    expect(
      buildPaletteGroups({ query: 'zzzzqqq', actions, recentToolIds: [], entities: [] }),
    ).toEqual([]);
  });
});

describe('entityPath', () => {
  it('routes each entity kind to its module with an encoded id', () => {
    expect(entityPath({ ...snippet, id: 'a/b' })).toBe('/snippets?snippet=a%2Fb');
    expect(entityPath({ ...snippet, kind: 'request' })).toBe('/api/requests?request=s1');
    expect(entityPath({ ...snippet, kind: 'document' })).toBe('/json/formatter?document=s1');
    expect(entityPath({ ...snippet, kind: 'query' })).toBe('/sql?query=s1');
    expect(entityPath({ ...snippet, kind: 'history' })).toBe('/history?entry=s1');
  });
});
