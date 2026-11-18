import { DevStudioDatabase } from '@/services/db/database';

let counter = 0;

/** Creates an isolated database (unique name) backed by fake-indexeddb. */
export function createTestDatabase(): DevStudioDatabase {
  counter += 1;
  return new DevStudioDatabase(`devstudio-test-${counter}-${Date.now()}`);
}

/** Clears every table of a database (used for the app-wide singleton in component tests). */
export async function clearDatabase(database: DevStudioDatabase): Promise<void> {
  await Promise.all(database.tables.map((t) => t.clear()));
}
