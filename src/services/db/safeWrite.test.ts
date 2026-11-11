import { describe, expect, it } from 'vitest';
import { StorageError, StorageQuotaError } from '@/core/errors/AppError';
import { isQuotaExceededError, safeWrite } from './safeWrite';

describe('safeWrite', () => {
  it('passes results through', async () => {
    await expect(safeWrite(() => Promise.resolve(42))).resolves.toBe(42);
  });

  it('maps quota errors (including Dexie-wrapped) to StorageQuotaError', async () => {
    const quota = new DOMException('full', 'QuotaExceededError');
    await expect(safeWrite(() => Promise.reject(quota))).rejects.toBeInstanceOf(StorageQuotaError);
    const wrapped = Object.assign(new Error('AbortError'), { name: 'AbortError', inner: quota });
    await expect(safeWrite(() => Promise.reject(wrapped))).rejects.toBeInstanceOf(
      StorageQuotaError,
    );
  });

  it('maps other failures to StorageError with context', async () => {
    const promise = safeWrite(() => Promise.reject(new Error('constraint failed')));
    await expect(promise).rejects.toBeInstanceOf(StorageError);
    await expect(promise).rejects.toThrow('Could not save data: constraint failed');
  });

  it('detects quota errors by name and legacy codes', () => {
    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError(new Error('x'))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });
});
