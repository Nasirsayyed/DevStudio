import {
  BACKUP_SECTIONS,
  type BackupData,
  type BackupSection,
  type BackupTable,
  BACKUP_TABLES,
} from '@/core/backup/backup';
import type { DevStudioDatabase } from '@/services/db/database';
import { db as defaultDb } from '@/services/db/database';
import { safeWrite } from '@/services/db/safeWrite';
import { secretVault } from '@/services/api/secretVault';
import { loadPreferences } from '@/services/preferences/preferences';
import type { EnvironmentEntity, FavoriteEntity } from '@/types/entities';

export type RestoreMode = 'merge' | 'replace';

/** Reads the tables of the chosen sections (and preferences with the settings section). */
export async function readBackupData(
  sections: readonly BackupSection[],
  database: DevStudioDatabase = defaultDb,
): Promise<BackupData> {
  const tables: BackupData['tables'] = {};
  for (const section of sections)
    for (const name of BACKUP_SECTIONS[section])
      tables[name] = await database.table(name).toArray();
  return { tables, preferences: sections.includes('settings') ? loadPreferences() : null };
}

/** Number of rows per table (Settings → Storage). */
export async function tableCounts(
  database: DevStudioDatabase = defaultDb,
): Promise<Record<BackupTable, number>> {
  const entries = await Promise.all(
    BACKUP_TABLES.map(async (t) => [t, await database.table(t).count()] as const),
  );
  return Object.fromEntries(entries) as Record<BackupTable, number>;
}

/**
 * Writes a validated backup in one transaction: either everything is restored or nothing is.
 * `replace` clears each table in the backup first; `merge` adds rows and replaces those with the
 * same id. Unique indexes are respected in merge mode: an environment whose name already exists
 * replaces that environment, and a favorite that already exists is kept.
 */
export async function restoreBackup(
  data: BackupData,
  mode: RestoreMode,
  database: DevStudioDatabase = defaultDb,
): Promise<Partial<Record<BackupTable, number>>> {
  const names = BACKUP_TABLES.filter((t) => data.tables[t] !== undefined);
  const written: Partial<Record<BackupTable, number>> = {};
  await safeWrite(() =>
    database.transaction(
      'rw',
      names.map((n) => database.table(n)),
      async () => {
        for (const name of names) {
          const table = database.table(name);
          let rows = data.tables[name] ?? [];
          if (mode === 'replace') await table.clear();
          else if (name === 'environments') {
            const existing = (await table.toArray()) as EnvironmentEntity[];
            const byName = new Map(existing.map((e) => [e.name, e.id]));
            rows = (rows as EnvironmentEntity[]).map((e) => ({
              ...e,
              id: byName.get(e.name) ?? e.id,
            }));
          } else if (name === 'favorites') {
            const existing = (await table.toArray()) as FavoriteEntity[];
            const keys = new Set(existing.map((f) => `${f.entityType}:${f.entityId}`));
            const ids = new Set(existing.map((f) => f.id));
            rows = (rows as FavoriteEntity[]).filter(
              (f) => ids.has(f.id) || !keys.has(`${f.entityType}:${f.entityId}`),
            );
          }
          // Duplicates of a unique index inside the file itself: the last one wins.
          if (name === 'environments') rows = dedupe(rows as EnvironmentEntity[], (e) => e.name);
          if (name === 'favorites')
            rows = dedupe(rows as FavoriteEntity[], (f) => `${f.entityType}:${f.entityId}`);
          await table.bulkPut(rows);
          written[name] = rows.length;
        }
      },
    ),
  );
  if (names.includes('environments')) secretVault.clear();
  return written;
}

function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const r of rows) map.set(key(r), r);
  return [...map.values()];
}

/** Deletes every table (Settings → Delete all data). */
export async function clearAllData(database: DevStudioDatabase = defaultDb): Promise<void> {
  await safeWrite(() =>
    database.transaction('rw', database.tables, () =>
      Promise.all(database.tables.map((t) => t.clear())),
    ),
  );
  secretVault.clear();
}
