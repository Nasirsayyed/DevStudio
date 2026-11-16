import { NotFoundError, ValidationError } from '@/core/errors/AppError';
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
  };
}

export const apiCollectionsRepository = createApiCollectionsRepository();
