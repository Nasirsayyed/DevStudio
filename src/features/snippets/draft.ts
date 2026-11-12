import type { SnippetDraft } from '@/core/snippets/model';
import type { CodeSnippetEntity } from '@/types/entities';

export function toDraft(s: CodeSnippetEntity): SnippetDraft {
  return {
    title: s.title,
    description: s.description,
    code: s.code,
    language: s.language,
    category: s.category,
    tags: s.tags,
  };
}
