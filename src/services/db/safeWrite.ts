import { StorageError, StorageQuotaError } from '@/core/errors/AppError';

/** Detects quota errors across browsers and Dexie's wrapped variants. */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; inner?: unknown; code?: unknown };
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (e.code === 22 || e.code === 1014) return true;
  return e.inner ? isQuotaExceededError(e.inner) : false;
}

/**
 * Wraps every IndexedDB write. Converts low-level failures into AppErrors so
 * the UI can show an actionable message instead of a raw DOMException.
 */
export async function safeWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isQuotaExceededError(error)) throw new StorageQuotaError(error);
    throw new StorageError(
      error instanceof Error ? `Could not save data: ${error.message}` : 'Could not save data.',
      error,
    );
  }
}
