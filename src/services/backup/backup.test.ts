import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_TABLES, createBackup, parseBackup } from '@/core/backup/backup';
import { emptyRequest } from '@/core/http/model';
import { secretVault } from '@/services/api/secretVault';
import type { DevStudioDatabase } from '@/services/db/database';
import { createApiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { createEnvironmentsRepository } from '@/services/db/repositories/environmentsRepository';
import { DEFAULT_PREFERENCES, parsePreferences } from '@/services/preferences/preferences';
import { createTestDatabase } from '@/test/db';
import { clearAllData, readBackupData, restoreBackup, tableCounts } from './backupService';

let source: DevStudioDatabase;
let target: DevStudioDatabase;
beforeEach(() => {
  source = createTestDatabase();
  target = createTestDatabase();
  secretVault.clear();
});
afterEach(async () => {
  await source.delete();
  await target.delete();
});

const now = 1_700_000_000_000;
const options = { appVersion: '0.9.0', schemaVersion: 1, now: new Date(now) };

async function seed(db: DevStudioDatabase) {
  const collections = createApiCollectionsRepository(db);
  const c = await collections.saveCollection({ name: 'Shop' });
  await collections.saveRequest({
    collectionId: c.id,
    folderId: null,
    draft: emptyRequest({
      name: 'Me',
      url: 'https://api.test/me',
      auth: { ...emptyRequest().auth, type: 'bearer', token: 'saved-with-consent' },
    }),
  });
  const envs = createEnvironmentsRepository(db);
  await envs.save({
    name: 'Prod',
    persistSecrets: true,
    variables: [
      { id: 'a', key: 'token', value: 'stored-secret', enabled: true, secret: true },
      { id: 'b', key: 'host', value: 'api.test', enabled: true, secret: false },
    ],
  });
  await db.savedQueries.add({
    id: 'q1',
    createdAt: now,
    updatedAt: now,
    name: 'DB',
    dialect: 'sqlite',
    kind: 'sqliteDb',
    tags: [],
    content: new Uint8Array([0, 1, 2, 250, 255]),
    sizeBytes: 5,
  });
  await db.toolHistory.add({
    id: 'h1',
    toolId: 'json.formatter',
    createdAt: now,
    label: 'Formatted',
    input: '{}',
    output: '{}',
    options: {},
    durationMs: null,
  });
  await db.favorites.add({
    id: 'f1',
    entityType: 'tool',
    entityId: 'json.formatter',
    createdAt: now,
    order: 0,
  });
  await db.settings.add({
    key: 'dashboard.quickAccess',
    value: ['json.formatter'],
    updatedAt: now,
  });
}

describe('backup and restore', () => {
  it('round-trips every table, including binary SQLite databases, without secrets by default', async () => {
    await seed(source);
    const text = createBackup(await readBackupData(['work', 'history', 'settings'], source), {
      ...options,
      sections: ['work', 'history', 'settings'],
      includeSecrets: false,
    });
    expect(text).not.toContain('saved-with-consent');
    expect(text).not.toContain('stored-secret');

    const parsed = parseBackup(text);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.counts).toMatchObject({
      collections: 1,
      apiRequests: 1,
      environments: 1,
      savedQueries: 1,
      toolHistory: 1,
      favorites: 1,
      settings: 1,
    });
    expect(parsed.data.preferences).toEqual(DEFAULT_PREFERENCES);
    await restoreBackup(parsed.data, 'replace', target);

    const q = await target.savedQueries.get('q1');
    expect(Array.from(q?.content as Uint8Array)).toEqual([0, 1, 2, 250, 255]);
    const env = await target.environments.where('name').equals('Prod').first();
    expect(env).toMatchObject({ persistSecrets: false });
    expect(env?.variables.map((v) => v.value)).toEqual(['', 'api.test']);
    const [request] = await target.apiRequests.toArray();
    expect(request?.config).toMatchObject({ auth: { type: 'bearer', token: '' } });
    expect(await tableCounts(target)).toMatchObject({
      toolHistory: 1,
      favorites: 1,
      codeSnippets: 0,
    });
  });

  it('keeps secrets only when asked to', async () => {
    await seed(source);
    const text = createBackup(await readBackupData(['work'], source), {
      ...options,
      sections: ['work'],
      includeSecrets: true,
    });
    expect(text).toContain('saved-with-consent');
    expect(text).toContain('stored-secret');
    const parsed = parseBackup(text);
    expect(parsed.includesSecrets).toBe(true);
    expect(parsed.counts.toolHistory).toBeUndefined();
    expect(parsed.data.preferences).toBeNull();
  });

  it('merges without breaking unique indexes, or replaces everything', async () => {
    await seed(source);
    const text = createBackup(await readBackupData(['work', 'history'], source), {
      ...options,
      sections: ['work', 'history'],
      includeSecrets: false,
    });
    // The target already has its own "Prod" environment and the same favorite with another id.
    await createEnvironmentsRepository(target).save({
      name: 'Prod',
      persistSecrets: false,
      variables: [],
    });
    await target.favorites.add({
      id: 'other',
      entityType: 'tool',
      entityId: 'json.formatter',
      createdAt: now,
      order: 1,
    });
    await target.toolHistory.add({
      id: 'mine',
      toolId: 'x',
      createdAt: now,
      label: 'mine',
      input: '',
      output: '',
      options: {},
      durationMs: null,
    });

    const parsed = parseBackup(text);
    await restoreBackup(parsed.data, 'merge', target);
    expect(await target.environments.where('name').equals('Prod').count()).toBe(1);
    expect(
      (await target.environments.where('name').equals('Prod').first())?.variables,
    ).toHaveLength(2);
    expect((await target.favorites.toArray()).map((f) => f.id)).toEqual(['other']);
    expect(await target.toolHistory.count()).toBe(2);

    await restoreBackup(parsed.data, 'replace', target);
    expect((await target.toolHistory.toArray()).map((h) => h.id)).toEqual(['h1']);
    expect((await target.favorites.toArray()).map((f) => f.id)).toEqual(['f1']);
  });

  it('validates files and skips invalid rows', () => {
    expect(() => parseBackup('nope')).toThrow('not valid JSON');
    expect(() => parseBackup('{"format":"other"}')).toThrow('not a DevStudio backup');
    expect(() =>
      parseBackup(JSON.stringify({ format: 'devstudio.backup', version: 99, tables: {} })),
    ).toThrow(/newer version/);
    const parsed = parseBackup(
      JSON.stringify({
        format: 'devstudio.backup',
        version: 1,
        app: { version: 'x', schemaVersion: 7 },
        tables: {
          toolHistory: [
            {
              id: 'ok',
              toolId: 't',
              createdAt: 1,
              label: 'l',
              input: '',
              output: '',
              options: {},
              durationMs: null,
            },
            { id: 'bad', toolId: 't' },
            'string',
          ],
          apiRequests: [
            {
              id: 'r',
              createdAt: 1,
              updatedAt: 1,
              collectionId: null,
              folderId: null,
              name: 'n',
              method: 'GET',
              url: 'u',
              config: { body: { mode: 'nope' } },
            },
          ],
          savedQueries: [
            {
              id: 'q',
              createdAt: 1,
              updatedAt: 1,
              name: 'n',
              dialect: 'sqlite',
              kind: 'sqliteDb',
              tags: [],
              content: { $devstudioBytes: '%%%' },
            },
          ],
          favorites: 'not a list',
          evil: [{ __proto__: { polluted: true } }],
        },
      }),
    );
    expect(parsed.counts).toEqual({ toolHistory: 1, apiRequests: 0, savedQueries: 0 });
    expect(parsed.skipped).toEqual({ toolHistory: 2, apiRequests: 1, savedQueries: 1 });
    expect(parsed.warnings).toEqual([
      'The backup comes from a newer database schema; unknown fields are ignored.',
      '"favorites" is not a list and was ignored.',
      'Unknown table "evil" was ignored.',
      '4 invalid item(s) will be skipped.',
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('a failing restore changes nothing', async () => {
    await target.toolHistory.add({
      id: 'keep',
      toolId: 'x',
      createdAt: now,
      label: 'k',
      input: '',
      output: '',
      options: {},
      durationMs: null,
    });
    await expect(
      restoreBackup(
        { tables: { toolHistory: [], toolUsage: [{ count: 1 }] }, preferences: null },
        'replace',
        target,
      ),
    ).rejects.toThrow();
    expect(await target.toolHistory.count()).toBe(1);
  });

  it('clears all data', async () => {
    await seed(source);
    await clearAllData(source);
    const counts = await tableCounts(source);
    expect(BACKUP_TABLES.every((t) => counts[t] === 0)).toBe(true);
  });
});

describe('parsePreferences', () => {
  it('keeps valid fields and falls back per field', () => {
    expect(
      parsePreferences({ ...DEFAULT_PREFERENCES, themeMode: 'dark', sidebarCollapsed: 'yes' }),
    ).toMatchObject({ themeMode: 'dark', sidebarCollapsed: DEFAULT_PREFERENCES.sidebarCollapsed });
    expect(parsePreferences('x')).toBeNull();
    expect(parsePreferences([])).toBeNull();
  });
});
