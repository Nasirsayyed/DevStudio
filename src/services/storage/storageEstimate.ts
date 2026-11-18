/** StorageManager members are missing in older browsers and some privacy modes. */
function getStorageManager(): Partial<StorageManager> | undefined {
  return typeof navigator !== 'undefined'
    ? (navigator as { storage?: Partial<StorageManager> }).storage
    : undefined;
}

export interface StorageEstimateResult {
  supported: boolean;
  usageBytes: number;
  quotaBytes: number;
  persisted: boolean;
}

/** Reports browser storage usage for this origin (IndexedDB + caches + ...). */
export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  const storage = getStorageManager();
  if (!storage?.estimate)
    return { supported: false, usageBytes: 0, quotaBytes: 0, persisted: false };
  const [estimate, persisted] = await Promise.all([
    storage.estimate(),
    storage.persisted?.() ?? Promise.resolve(false),
  ]);
  return {
    supported: true,
    usageBytes: estimate.usage ?? 0,
    quotaBytes: estimate.quota ?? 0,
    persisted,
  };
}

/** Asks the browser to protect this origin's data from automatic eviction. */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = getStorageManager();
  if (!storage?.persist) return false;
  return storage.persist();
}
