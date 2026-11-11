import { useLiveQuery } from 'dexie-react-hooks';
import { jsonDocumentsRepository, type SaveJsonDocumentInput } from '@/services/db/repositories';
import type { JsonDocumentEntity } from '@/types/entities';

/** Live list of saved JSON documents (only queried while `enabled`). */
export function useJsonDocumentList(
  enabled: boolean,
  query: string,
): JsonDocumentEntity[] | undefined {
  return useLiveQuery(
    () => (enabled ? jsonDocumentsRepository.list(query) : Promise.resolve([])),
    [enabled, query],
  );
}

export function saveJsonDocument(input: SaveJsonDocumentInput): Promise<JsonDocumentEntity> {
  return jsonDocumentsRepository.save(input);
}

export function removeJsonDocument(id: string): Promise<void> {
  return jsonDocumentsRepository.remove(id);
}
