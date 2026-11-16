import { ValidationError } from '@/core/errors/AppError';
import type { EnvironmentEntity, EnvironmentVariable } from '@/types/entities';
import { secretVault } from '@/services/api/secretVault';
import { type DevStudioDatabase, db as defaultDb } from '../database';
import { createId } from '../ids';
import { safeWrite } from '../safeWrite';

export interface SaveEnvironmentInput {
  id?: string;
  name: string;
  variables: EnvironmentVariable[];
  /** The user agreed to store secret values in plaintext on this device. */
  persistSecrets: boolean;
}

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
export const BUILT_IN_ENVIRONMENTS = ['Development', 'Testing', 'Staging', 'Production'] as const;

/**
 * Environments. Secret values are written to IndexedDB only when the environment opted in;
 * otherwise they are kept in memory (secretVault) and merged back when reading.
 */
export function createEnvironmentsRepository(db: DevStudioDatabase = defaultDb) {
  const table = db.environments;
  const withSecrets = (e: EnvironmentEntity): EnvironmentEntity =>
    e.persistSecrets
      ? e
      : {
          ...e,
          variables: e.variables.map((v) =>
            v.secret ? { ...v, value: secretVault.get(e.id, v.id) ?? '' } : v,
          ),
        };

  return {
    async list(): Promise<EnvironmentEntity[]> {
      const all = await table.toArray();
      const order = (e: EnvironmentEntity) => {
        const i = BUILT_IN_ENVIRONMENTS.indexOf(e.name as (typeof BUILT_IN_ENVIRONMENTS)[number]);
        return e.isBuiltIn && i >= 0 ? i : 100;
      };
      return all
        .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
        .map(withSecrets);
    },

    async get(id: string): Promise<EnvironmentEntity | undefined> {
      const e = await table.get(id);
      return e ? withSecrets(e) : undefined;
    },

    /** Creates Development, Testing, Staging and Production the first time. */
    async ensureDefaults(): Promise<void> {
      await safeWrite(() =>
        db.transaction('rw', table, async () => {
          if ((await table.count()) > 0) return;
          const now = Date.now();
          await table.bulkAdd(
            BUILT_IN_ENVIRONMENTS.map((name, i) => ({
              id: createId(),
              createdAt: now + i,
              updatedAt: now + i,
              name,
              isBuiltIn: true,
              persistSecrets: false,
              variables: [
                {
                  id: createId(),
                  key: 'baseUrl',
                  value:
                    name === 'Development'
                      ? 'http://localhost:3000'
                      : `https://${name.toLowerCase()}.example.com`,
                  enabled: true,
                  secret: false,
                },
              ],
            })),
          );
        }),
      );
    },

    async save(input: SaveEnvironmentInput): Promise<EnvironmentEntity> {
      const name = input.name.trim();
      if (!name) throw new ValidationError('Give the environment a name.');
      if (name.length > 100)
        throw new ValidationError('Environment names can have at most 100 characters.');
      const keys = new Set<string>();
      for (const v of input.variables) {
        const key = v.key.trim();
        if (!key) continue;
        if (!VARIABLE_NAME.test(key))
          throw new ValidationError(
            `"${key}" is not a valid variable name (letters, digits, _ . - ; not starting with a digit).`,
          );
        if (keys.has(key)) throw new ValidationError(`The variable "${key}" is defined twice.`);
        keys.add(key);
      }
      const variables = input.variables
        .filter((v) => v.key.trim())
        .map((v) => ({ ...v, key: v.key.trim() }));
      return safeWrite(() =>
        db.transaction('rw', table, async () => {
          const existing = input.id ? await table.get(input.id) : undefined;
          const clash = await table.where('name').equals(name).first();
          if (clash && clash.id !== existing?.id)
            throw new ValidationError(`An environment named "${name}" already exists.`);
          const now = Date.now();
          const id = existing?.id ?? createId();
          const stored: EnvironmentEntity = {
            id,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            name,
            isBuiltIn: existing?.isBuiltIn ?? false,
            persistSecrets: input.persistSecrets,
            variables: variables.map((v) =>
              v.secret && !input.persistSecrets ? { ...v, value: '' } : v,
            ),
          };
          await table.put(stored);
          secretVault.set(
            id,
            new Map(
              input.persistSecrets
                ? []
                : variables.filter((v) => v.secret).map((v) => [v.id, v.value]),
            ),
          );
          return withSecrets(stored);
        }),
      );
    },

    async remove(id: string): Promise<void> {
      await safeWrite(() => table.delete(id));
      secretVault.clear(id);
    },
  };
}

export const environmentsRepository = createEnvironmentsRepository();

/** Enabled variables as a lookup map (later keys win). */
export function variableMap(
  variables: readonly { key: string; value: string; enabled: boolean }[],
): Map<string, string> {
  return new Map(variables.filter((v) => v.enabled && v.key).map((v) => [v.key, v.value]));
}
