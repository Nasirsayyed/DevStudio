import { NotFoundError, ValidationError } from '@/core/errors/AppError';
import type { CollectionBundle } from '@/core/http/collections';
import { parseRequestDraft, type RequestDraft } from '@/core/http/model';
import type {
  ApiRequestEntity,
  CollectionEntity,
  CollectionFolder,
  KeyValueEntry,
} from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

/** Request collections, folders and saved requests (API Studio). Import by path. */

export interface SaveRequestInput {
  id?: string;
  collectionId: string | null;
  folderId: string | null;
  draft: RequestDraft;
}

const name = (n: string, what: string) => {
  const t = n.trim();
  if (!t) throw new ValidationError(`Give the ${what} a name.`);
  if (t.length > 200)
    throw new ValidationError(
      `${what[0]?.toUpperCase() ?? ''}${what.slice(1)} names can have at most 200 characters.`,
    );
  return t;
};

/** Ids of a folder and all its descendants. */
export function folderSubtree(folders: readonly CollectionFolder[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders)
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
  }
  return ids;
}

export function createApiCollectionsRepository(db: DevStudioDatabase = defaultDb) {
  const collections = db.collections;
  const requests = db.apiRequests;

  return {
    listCollections(): Promise<CollectionEntity[]> {
      return collections.orderBy('name').toArray();
    },

    getCollection(id: string): Promise<CollectionEntity | undefined> {
      return collections.get(id);
    },

    async saveCollection(input: {
      id?: string;
      name: string;
      description?: string;
      variables?: KeyValueEntry[];
    }): Promise<CollectionEntity> {
      const n = name(input.name, 'collection');
      return safeWrite(() =>
        db.transaction('rw', collections, async () => {
          const existing = input.id ? await collections.get(input.id) : undefined;
          if (input.id && !existing) throw new NotFoundError('This collection no longer exists.');
          const now = Date.now();
          const entity: CollectionEntity = {
            id: existing?.id ?? createId(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            name: n,
            description: input.description ?? existing?.description ?? '',
            folders: existing?.folders ?? [],
            variables: input.variables ?? existing?.variables ?? [],
          };
          await collections.put(entity);
          return entity;
        }),
      );
    },

    /** Deletes a collection and every request in it. */
    async removeCollection(id: string): Promise<void> {
      await safeWrite(() =>
        db.transaction('rw', collections, requests, async () => {
          await requests.where('collectionId').equals(id).delete();
          await collections.delete(id);
        }),
      );
    },

    async addFolder(
      collectionId: string,
      folderName: string,
      parentId: string | null = null,
    ): Promise<CollectionFolder> {
      const n = name(folderName, 'folder');
      return safeWrite(() =>
        db.transaction('rw', collections, async () => {
          const c = await collections.get(collectionId);
          if (!c) throw new NotFoundError('This collection no longer exists.');
          if (parentId && !c.folders.some((f) => f.id === parentId))
            throw new NotFoundError('That folder no longer exists.');
          const folder: CollectionFolder = { id: createId(), name: n, parentId };
          await collections.update(collectionId, {
            folders: [...c.folders, folder],
            updatedAt: Date.now(),
          });
          return folder;
        }),
      );
    },

    async renameFolder(collectionId: string, folderId: string, folderName: string): Promise<void> {
      const n = name(folderName, 'folder');
      await safeWrite(() =>
        db.transaction('rw', collections, async () => {
          const c = await collections.get(collectionId);
          if (!c) throw new NotFoundError('This collection no longer exists.');
          await collections.update(collectionId, {
            folders: c.folders.map((f) => (f.id === folderId ? { ...f, name: n } : f)),
            updatedAt: Date.now(),
          });
        }),
      );
    },

    /** Deletes a folder, its subfolders and their requests. */
    async removeFolder(collectionId: string, folderId: string): Promise<void> {
      await safeWrite(() =>
        db.transaction('rw', collections, requests, async () => {
          const c = await collections.get(collectionId);
          if (!c) return;
          const ids = folderSubtree(c.folders, folderId);
          await requests
            .where('collectionId')
            .equals(collectionId)
            .filter((r) => r.folderId !== null && ids.has(r.folderId))
            .delete();
          await collections.update(collectionId, {
            folders: c.folders.filter((f) => !ids.has(f.id)),
            updatedAt: Date.now(),
          });
        }),
      );
    },

    /** All requests, or those of one collection; ordered by name. */
    async listRequests(collectionId?: string | null): Promise<ApiRequestEntity[]> {
      const rows =
        collectionId === undefined
          ? await requests.toArray()
          : collectionId === null
            ? await requests.filter((r) => r.collectionId === null).toArray()
            : await requests.where('collectionId').equals(collectionId).toArray();
      return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    },

    getRequest(id: string): Promise<ApiRequestEntity | undefined> {
      return requests.get(id);
    },

    /** The stored request as an editable draft (defaults filled in). */
    draftOf(r: ApiRequestEntity): RequestDraft {
      return parseRequestDraft({ ...r.config, name: r.name, method: r.method, url: r.url });
    },

    async saveRequest(input: SaveRequestInput): Promise<ApiRequestEntity> {
      const draft = parseRequestDraft(input.draft);
      const n = name(draft.name, 'request');
      return safeWrite(() =>
        db.transaction('rw', requests, collections, async () => {
          const existing = input.id ? await requests.get(input.id) : undefined;
          if (input.id && !existing) throw new NotFoundError('This request no longer exists.');
          if (input.collectionId && !(await collections.get(input.collectionId)))
            throw new NotFoundError('That collection no longer exists.');
          const now = Date.now();
          const { name: _n, method, url, ...config } = draft;
          const entity: ApiRequestEntity = {
            id: existing?.id ?? createId(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            collectionId: input.collectionId,
            folderId: input.folderId,
            name: n,
            method,
            url,
            config: config,
          };
          await requests.put(entity);
          return entity;
        }),
      );
    },

    async duplicateRequest(id: string): Promise<ApiRequestEntity> {
      const r = await requests.get(id);
      if (!r) throw new NotFoundError('This request no longer exists.');
      const draft = this.draftOf(r);
      return this.saveRequest({
        collectionId: r.collectionId,
        folderId: r.folderId,
        draft: { ...draft, name: `${draft.name} (copy)`.slice(0, 200) },
      });
    },

    async removeRequest(id: string): Promise<void> {
      await safeWrite(() => requests.delete(id));
    },

    /** Requests of a collection in run order: `runOrder` first, then folder by folder, by name. */
    async runOrder(collectionId: string): Promise<ApiRequestEntity[]> {
      const c = await collections.get(collectionId);
      if (!c) throw new NotFoundError('This collection no longer exists.');
      const all = await this.listRequests(collectionId);
      const byId = new Map(all.map((r) => [r.id, r]));
      const ordered = (c.runOrder ?? []).flatMap((id) => byId.get(id) ?? []);
      const seen = new Set(ordered.map((r) => r.id));
      const walk = (parentId: string | null): ApiRequestEntity[] => [
        ...all.filter((r) => (r.folderId ?? null) === parentId && !seen.has(r.id)),
        ...c.folders.filter((f) => f.parentId === parentId).flatMap((f) => walk(f.id)),
      ];
      const rest = walk(null);
      // Requests in folders that no longer exist still run, last.
      const placed = new Set([...seen, ...rest.map((r) => r.id)]);
      return [...ordered, ...rest, ...all.filter((r) => !placed.has(r.id))];
    },

    async setRunOrder(collectionId: string, ids: readonly string[]): Promise<void> {
      await safeWrite(() =>
        collections.update(collectionId, { runOrder: [...ids].slice(0, 10_000) }),
      );
    },

    /** Creates a collection with its folders and requests in one transaction (new ids). */
    async importBundle(bundle: CollectionBundle): Promise<CollectionEntity> {
      const n = name(bundle.name, 'collection');
      return safeWrite(() =>
        db.transaction('rw', collections, requests, async () => {
          const now = Date.now();
          const ids = new Map(bundle.folders.map((f) => [f.id, createId()]));
          const folders: CollectionFolder[] = bundle.folders.map((f) => ({
            id: ids.get(f.id) ?? createId(),
            name: f.name.trim().slice(0, 200) || 'Folder',
            parentId: f.parentId ? (ids.get(f.parentId) ?? null) : null,
          }));
          const entities: ApiRequestEntity[] = bundle.requests.map((r, i) => {
            const draft = parseRequestDraft(r.draft);
            const { name: requestName, method, url, ...config } = draft;
            return {
              id: createId(),
              createdAt: now + i,
              updatedAt: now + i,
              collectionId: '',
              folderId: r.folderId ? (ids.get(r.folderId) ?? null) : null,
              name: requestName.trim().slice(0, 200) || 'Request',
              method,
              url,
              config,
            };
          });
          const collection: CollectionEntity = {
            id: createId(),
            createdAt: now,
            updatedAt: now,
            name: n,
            description: bundle.description.slice(0, 100_000),
            folders,
            variables: bundle.variables,
            runOrder: entities.map((e) => e.id),
          };
          await collections.add(collection);
          await requests.bulkAdd(entities.map((e) => ({ ...e, collectionId: collection.id })));
          return collection;
        }),
      );
    },

    /** A collection with its folders and requests, in run order, for export. */
    async exportBundle(collectionId: string): Promise<CollectionBundle> {
      const c = await collections.get(collectionId);
      if (!c) throw new NotFoundError('This collection no longer exists.');
      const ordered = await this.runOrder(collectionId);
      const folderIds = new Set(c.folders.map((f) => f.id));
      return {
        name: c.name,
        description: c.description,
        variables: c.variables,
        folders: c.folders,
        requests: ordered.map((r) => ({
          folderId: r.folderId && folderIds.has(r.folderId) ? r.folderId : null,
          draft: this.draftOf(r),
        })),
      };
    },
  };
}

export const apiCollectionsRepository = createApiCollectionsRepository();
