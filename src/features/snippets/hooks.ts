import { useLiveQuery } from 'dexie-react-hooks';
import { snippetsRepository } from '@/services/db/repositories/snippetsRepository';
import type { CodeSnippetEntity } from '@/types/entities';

/** The whole library, live (re-renders on every change, also from other tabs). */
export function useSnippets(): CodeSnippetEntity[] | undefined {
  return useLiveQuery(() => snippetsRepository.list(), []);
}
