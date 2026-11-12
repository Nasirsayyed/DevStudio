import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useNotify } from '@/components';
import { toUserMessage } from '@/core/errors/AppError';
import type {
  SqlOperationInput,
  SqlOperationName,
  SqlOperationOutput,
} from '@/core/sql/operations';
import { type OperationState, useTaskOperation } from '@/hooks/useTaskOperation';
import { savedQueriesRepository } from '@/services/db/repositories/savedQueriesRepository';
import { sqlTasks } from '@/services/workers/sqlTasks';
import { hydrateSqlWorkspaceDraft, useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';

/** SQL operations (main thread for small inputs, Web Worker for large ones). */
export function useSqlOperation<K extends SqlOperationName>(
  op: K,
  payload: SqlOperationInput<K> | null,
): OperationState<SqlOperationOutput<K>> {
  return useTaskOperation<SqlOperationInput<K>, SqlOperationOutput<K>>(
    `sql.${op}`,
    (p, o) => sqlTasks.run(op, p, o),
    payload,
  );
}

/**
 * Restores the SQL draft and opens `?query=<id>` (links from the command palette): scripts load
 * into the shared workspace; schema designs and databases open in their own tools.
 */
export function useSqlWorkspace(): void {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const set = useSqlWorkspaceStore((s) => s.set);
  const notify = useNotify();
  const id = params.get('query');

  useEffect(() => {
    void hydrateSqlWorkspaceDraft();
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    hydrateSqlWorkspaceDraft()
      .then(() => savedQueriesRepository.get(id))
      .then((q) => {
        if (cancelled) return;
        if (!q) {
          notify.warning('That saved query no longer exists.');
        } else if (q.kind === 'schema') {
          void navigate(`/sql/schema-designer?query=${encodeURIComponent(id)}`, { replace: true });
          return;
        } else if (q.kind === 'sqliteDb') {
          void navigate(`/sql/playground?query=${encodeURIComponent(id)}`, { replace: true });
          return;
        } else if (typeof q.content === 'string') {
          set({ sql: q.content, dialect: q.dialect, query: { id: q.id, name: q.name } });
          notify.info(`Opened "${q.name}"`);
        }
        setParams(
          (p) => {
            p.delete('query');
            return p;
          },
          { replace: true },
        );
      })
      .catch((error: unknown) => {
        notify.error(toUserMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate, notify, set, setParams]);
}
