import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@/core/errors/AppError';
import { emptyRequest } from '@/core/http/model';
import { secretVault } from '@/services/api/secretVault';
import { createTestDatabase } from '@/test/db';
import type { DevStudioDatabase } from '../database';
import { createApiCollectionsRepository } from './apiCollectionsRepository';
import {
  createApiHistoryRepository,
  MAX_HISTORY_ENTRIES,
  truncateBody,
  HISTORY_BODY_LIMIT,
  type ApiHistorySnapshot,
} from './apiHistoryRepository';
import { createEnvironmentsRepository, variableMap } from './environmentsRepository';

let database: DevStudioDatabase;
beforeEach(() => {
  database = createTestDatabase();
  secretVault.clear();
});
afterEach(async () => {
  await database.delete();
});

const variable = (key: string, value: string, secret = false) => ({
  id: `v-${key}`,
  key,
  value,
  enabled: true,
  secret,
});

describe('environmentsRepository', () => {
  it('creates the built-in environments once, in a fixed order', async () => {
    const repo = createEnvironmentsRepository(database);
    await repo.ensureDefaults();
    await repo.ensureDefaults();
    expect((await repo.list()).map((e) => e.name)).toEqual([
      'Development',
      'Testing',
      'Staging',
      'Production',
    ]);
    expect((await repo.list())[0]?.variables[0]).toMatchObject({
      key: 'baseUrl',
      value: 'http://localhost:3000',
    });
  });

  it('keeps secret values in memory unless the user agreed to store them', async () => {
    const repo = createEnvironmentsRepository(database);
    const env = await repo.save({
      name: 'Local',
      persistSecrets: false,
      variables: [variable('host', 'x.org'), variable('token', 's3cret', true)],
    });
    const stored = await database.environments.get(env.id);
    expect(stored?.variables.find((v) => v.key === 'token')?.value).toBe('');
    expect((await repo.get(env.id))?.variables.find((v) => v.key === 'token')?.value).toBe(
      's3cret',
    );
    secretVault.clear();
    expect((await repo.get(env.id))?.variables.find((v) => v.key === 'token')?.value).toBe('');

    const persisted = await repo.save({
      id: env.id,
      name: 'Local',
      persistSecrets: true,
      variables: [variable('token', 'kept', true)],
    });
    expect((await database.environments.get(persisted.id))?.variables[0]?.value).toBe('kept');
    expect(
      variableMap([...persisted.variables, { key: 'off', value: '1', enabled: false }]),
    ).toEqual(new Map([['token', 'kept']]));
  });

  it('validates names and variables', async () => {
    const repo = createEnvironmentsRepository(database);
    await repo.save({ name: 'A', persistSecrets: false, variables: [] });
    await expect(repo.save({ name: ' A ', persistSecrets: false, variables: [] })).rejects.toThrow(
      'An environment named "A" already exists.',
    );
    await expect(
      repo.save({ name: '', persistSecrets: false, variables: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repo.save({ name: 'B', persistSecrets: false, variables: [variable('a b', '1')] }),
    ).rejects.toThrow(/not a valid variable name/);
    await expect(
      repo.save({
        name: 'B',
        persistSecrets: false,
        variables: [variable('a', '1'), { ...variable('a', '2'), id: 'x' }],
      }),
    ).rejects.toThrow(/defined twice/);
    const saved = await repo.save({
      name: 'B',
      persistSecrets: false,
      variables: [variable('', 'ignored'), variable('ok', '1')],
    });
    expect(saved.variables.map((v) => v.key)).toEqual(['ok']);
  });
});

describe('apiCollectionsRepository', () => {
  it('saves requests in collections and folders and deletes folders and collections with their requests', async () => {
    const repo = createApiCollectionsRepository(database);
    const c = await repo.saveCollection({ name: 'Shop API' });
    const users = await repo.addFolder(c.id, 'Users');
    const admin = await repo.addFolder(c.id, 'Admin', users.id);
    const r1 = await repo.saveRequest({
      collectionId: c.id,
      folderId: admin.id,
      draft: emptyRequest({ name: 'List', url: '{{baseUrl}}/users', method: 'GET' }),
    });
    const r2 = await repo.saveRequest({
      collectionId: c.id,
      folderId: null,
      draft: emptyRequest({ name: 'Health', url: '/health' }),
    });
    await repo.saveRequest({
      collectionId: null,
      folderId: null,
      draft: emptyRequest({ name: 'Loose' }),
    });
    expect(r1).toMatchObject({ name: 'List', method: 'GET', url: '{{baseUrl}}/users' });
    expect(repo.draftOf(r1)).toMatchObject({ name: 'List', body: { mode: 'none' } });
    expect((await repo.listRequests(null)).map((r) => r.name)).toEqual(['Loose']);
    await repo.renameFolder(c.id, users.id, 'People');
    expect((await repo.getCollection(c.id))?.folders.map((f) => f.name)).toEqual([
      'People',
      'Admin',
    ]);
    const copy = await repo.duplicateRequest(r2.id);
    expect(copy.name).toBe('Health (copy)');

    await repo.removeFolder(c.id, users.id);
    expect((await repo.getCollection(c.id))?.folders).toEqual([]);
    expect((await repo.listRequests(c.id)).map((r) => r.name)).toEqual(['Health', 'Health (copy)']);
    await repo.removeCollection(c.id);
    expect(await database.apiRequests.count()).toBe(1);
  });

  it('validates names and reports missing items', async () => {
    const repo = createApiCollectionsRepository(database);
    await expect(repo.saveCollection({ name: ' ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.addFolder('nope', 'x')).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      repo.saveRequest({ collectionId: 'nope', folderId: null, draft: emptyRequest() }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      repo.saveRequest({ collectionId: null, folderId: null, draft: emptyRequest({ name: '' }) }),
    ).rejects.toThrow('Give the request a name.');
  });
});

describe('apiHistoryRepository', () => {
  const snapshot = (url: string, status: number | null): ApiHistorySnapshot => ({
    request: { method: 'GET', url, headers: [], body: null },
    response:
      status === null
        ? null
        : {
            status,
            statusText: '',
            headers: [],
            contentType: '',
            body: '',
            bodyTruncated: false,
            sizeBytes: 1,
            durationMs: 5,
          },
    error: status === null ? 'failed' : null,
    draft: null,
    environment: null,
  });

  it('records, filters and keeps at most MAX_HISTORY_ENTRIES', async () => {
    const repo = createApiHistoryRepository(database);
    await repo.record({ requestId: null, snapshot: snapshot('https://a.org/users', 200) });
    await repo.record({ requestId: null, snapshot: snapshot('https://a.org/missing', 404) });
    await repo.record({ requestId: null, snapshot: snapshot('https://b.org/x', null) });
    expect((await repo.list()).map((h) => h.status)).toEqual([null, 404, 200]);
    expect((await repo.list({ statusClass: 4 })).map((h) => h.url)).toEqual([
      'https://a.org/missing',
    ]);
    expect((await repo.list({ statusClass: 0 })).map((h) => h.url)).toEqual(['https://b.org/x']);
    expect((await repo.list({ query: 'USERS' })).length).toBe(1);
    for (let i = 0; i < MAX_HISTORY_ENTRIES; i += 1)
      await database.apiHistory.add({
        id: `h${String(i)}`,
        createdAt: i,
        requestId: null,
        method: 'GET',
        url: 'x',
        status: 200,
        durationMs: 1,
        sizeBytes: 1,
        snapshot: {},
      });
    await repo.record({ requestId: null, snapshot: snapshot('https://new.org', 200) });
    expect(await database.apiHistory.count()).toBe(MAX_HISTORY_ENTRIES);
    expect(await database.apiHistory.get('h0')).toBeUndefined();
    await repo.clear();
    expect(await database.apiHistory.count()).toBe(0);
    expect(truncateBody('x'.repeat(HISTORY_BODY_LIMIT + 1))).toMatchObject({ truncated: true });
  });
});
