import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import { jsonDocumentsRepository } from '@/services/db/repositories';
import { hydrateJsonWorkspaceDraft, useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';

/** Opens `?document=<id>` (links from the dashboard and command palette), then removes the param. */
export function useJsonDocumentFromUrl(): void {
  const [params, setParams] = useSearchParams();
  const loadDocument = useJsonWorkspaceStore((s) => s.loadDocument);
  const notify = useNotify();
  const id = params.get('document');

  useEffect(() => {
    void hydrateJsonWorkspaceDraft();
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // Wait for the draft first so it cannot overwrite the requested document.
    hydrateJsonWorkspaceDraft()
      .then(() => jsonDocumentsRepository.get(id))
      .then((doc) => {
        if (cancelled) return;
        if (doc) {
          loadDocument(doc.content, { id: doc.id, name: doc.name });
          notify.info(`Opened "${doc.name}"`);
        } else {
          notify.warning('That saved document no longer exists.');
        }
        setParams(
          (p) => {
            p.delete('document');
            return p;
          },
          { replace: true },
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) notify.error(toUserMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadDocument, notify, setParams]);
}
