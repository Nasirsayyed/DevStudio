import type {
  ApiHistoryEntity,
  CodeSnippetEntity,
  JsonDocumentEntity,
  SavedQueryEntity,
} from '@/types/entities';
import { type DevStudioDatabase, db as defaultDb } from '../database';

export interface WorkspaceCounts {
  collections: number;
  apiRequests: number;
  apiHistory: number;
  jsonDocuments: number;
  savedQueries: number;
  codeSnippets: number;
  favorites: number;
  toolHistory: number;
}

/** Read-only aggregate queries across the user's saved work (dashboard, overview). */
export function createWorkspaceRepository(db: DevStudioDatabase = defaultDb) {
  return {
    async counts(): Promise<WorkspaceCounts> {
      const [
        collections,
        apiRequests,
        apiHistory,
        jsonDocuments,
        savedQueries,
        codeSnippets,
        favorites,
        toolHistory,
      ] = await Promise.all([
        db.collections.count(),
        db.apiRequests.count(),
        db.apiHistory.count(),
        db.jsonDocuments.count(),
        db.savedQueries.count(),
        db.codeSnippets.count(),
        db.favorites.count(),
        db.toolHistory.count(),
      ]);
      return {
        collections,
        apiRequests,
        apiHistory,
        jsonDocuments,
        savedQueries,
        codeSnippets,
        favorites,
        toolHistory,
      };
    },

    recentApiHistory(limit: number): Promise<ApiHistoryEntity[]> {
      return db.apiHistory.orderBy('createdAt').reverse().limit(limit).toArray();
    },

    recentJsonDocuments(limit: number): Promise<JsonDocumentEntity[]> {
      return db.jsonDocuments.orderBy('updatedAt').reverse().limit(limit).toArray();
    },

    recentSnippets(limit: number): Promise<CodeSnippetEntity[]> {
      return db.codeSnippets.orderBy('updatedAt').reverse().limit(limit).toArray();
    },

    recentQueries(limit: number): Promise<SavedQueryEntity[]> {
      return db.savedQueries.orderBy('updatedAt').reverse().limit(limit).toArray();
    },
  };
}

export const workspaceRepository = createWorkspaceRepository();
