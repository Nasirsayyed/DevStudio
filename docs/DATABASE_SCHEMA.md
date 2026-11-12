# Database schema

DevStudio stores user data in **IndexedDB** (database `devstudio`, via Dexie 4) and lightweight
preferences in **localStorage**. Source: `src/services/db/database.ts` and `src/types/entities.ts`.

Current schema version: **1**

## IndexedDB tables

Index syntax: `&` = unique, `*` = multi-entry (array), `[a+b]` = compound. The first entry is the
primary key. All `id`s are UUID v7 (time-sortable) strings.

| Table           | Indexes                                                                        | Purpose                                                                          | Used since                                         |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| `collections`   | `id, name, updatedAt`                                                          | API collections with folder tree and variables                                   | Phase 10                                           |
| `apiRequests`   | `id, collectionId, folderId, name, method, updatedAt, [collectionId+folderId]` | Saved API requests                                                               | Phase 10 (searched by palette now)                 |
| `environments`  | `id, &name, updatedAt`                                                         | Environments and variables (`secret` flag, `persistSecrets` consent)             | Phase 10                                           |
| `apiHistory`    | `id, requestId, method, status, createdAt, url`                                | Sent requests with truncated response snapshots                                  | Phase 10 (dashboard reads now)                     |
| `jsonDocuments` | `id, name, *tags, updatedAt`                                                   | Saved JSON documents                                                             | ✅ Now (JSON Studio save/open, dashboard, palette) |
| `savedQueries`  | `id, name, dialect, kind, *tags, updatedAt`                                    | SQL scripts, schema designs (`kind=schema`), SQLite files (`kind=sqliteDb`)      | Phase 9                                            |
| `codeSnippets`  | `id, title, language, category, *tags, isFavorite, updatedAt`                  | Snippets (`isFavorite` stored as 0/1, because booleans can't be indexed)         | Phase 8                                            |
| `favorites`     | `id, &[entityType+entityId], entityType, createdAt`                            | Favorites of any entity type (`tool`, `request`, `snippet`, `document`, `query`) | ✅ Now (tools)                                     |
| `toolHistory`   | `id, toolId, createdAt, [toolId+createdAt]`                                    | Restorable tool operations                                                       | Phase 4+ / 11                                      |
| `settings`      | `key`                                                                          | Structured settings (e.g. `dashboard.quickAccess`)                               | ✅ Now                                             |
| `toolUsage`     | `toolId, count, lastUsedAt`                                                    | Per-tool open counters for dashboard statistics                                  | ✅ Now                                             |

`toolUsage` is an addition to the specified tables. It keeps dashboard statistics O(top-N) through
the `count` index instead of aggregating the whole history.

### Settings keys

| Key                     | Value                                                                                                                                                                                                                          | Validation                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `dashboard.quickAccess` | `string[]` of tool ids (max 9, ordered, maps to Alt+1…9)                                                                                                                                                                       | Zod; unknown tool ids are dropped on read |
| `jsonStudio.draft`      | `{ input, secondary, csv, xml, document: {id,name} \| null }`, the shared JSON workspace draft (JSON Studio and Code Generators; `xml` added in v0.3 and defaulted for older drafts) (fields above 5 M chars are stored empty) | Zod; invalid drafts are ignored           |

## Repositories

Features never touch Dexie directly. Each repository is created with
`createXRepository(db = defaultDb)` so tests can inject an isolated database.

| Repository            | Responsibilities                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favoritesRepository` | `list(type)`, `isFavorite`, atomic `toggle` (transaction), `remove`, `count`                                                                                                                                                                                |
| `toolUsageRepository` | atomic `recordUse`, `top(n)` via the `count` index, `totalUses`, `clear`                                                                                                                                                                                    |
| `settingsRepository`  | typed `get(key, zodSchema, fallback)`, `set`, `remove`                                                                                                                                                                                                      |
| `workspaceRepository` | counts per table, recent items by `updatedAt`/`createdAt` index                                                                                                                                                                                             |
| `snippetsRepository`  | validated `save` (Zod), `toggleFavorite` (keeps `updatedAt`), `duplicate`, `remove`/`removeMany`/`restore` (undo), `renameCategory`, `deleteCategory`, atomic `applyImport(plan)`. Imported by path, not from the barrel, to stay out of the initial bundle |
| `searchRepository`    | palette search: indexed case-insensitive prefix query, then a bounded (500 most recent) substring scan, at most N results per table                                                                                                                         |

## Writes and quota handling

Every write goes through `safeWrite()` (`services/db/safeWrite.ts`):

- `QuotaExceededError` (including Dexie-wrapped `inner` errors and legacy codes 22/1014) becomes a
  `StorageQuotaError` with an actionable message.
- Application errors thrown on purpose inside a transaction (`ValidationError`, `NotFoundError`)
  are rethrown unchanged, also when Dexie wraps them in `inner`.
- Any other failure becomes a `StorageError("Could not save data: …")`.

Settings → Storage shows `navigator.storage.estimate()` usage and can request persistent storage
(`navigator.storage.persist()`) to protect data from eviction.

## Snippet file format

Exports are JSON: `{ "format": "devstudio-snippets", "version": 1, "exportedAt": ISO date,
"snippets": [{ id, title, description, code, language, category, tags, isFavorite, createdAt,
updatedAt }] }` (dates as ISO strings). Imports also accept a bare array of snippets and VS Code
snippet files. Files from a newer format version are refused.

## Migrations

- Never edit a published `db.version(n)` definition.
- Add `this.version(n + 1).stores({...}).upgrade(tx => ...)` in `DevStudioDatabase`'s constructor,
  bump `CURRENT_SCHEMA_VERSION`, and add a migration test that seeds data at version n and asserts
  the upgraded shape.
- Backups (Phase 11) record the schema version and are migrated on import.

## localStorage

Key `devstudio:prefs:v1`. Only non-sensitive UI preferences live here:

| Field                   | Type                                                   | Default              |
| ----------------------- | ------------------------------------------------------ | -------------------- |
| `themeMode`             | `'light' \| 'dark' \| 'system'`                        | `system`             |
| `sidebarCollapsed`      | boolean                                                | `false`              |
| `selectedEnvironmentId` | string \| null                                         | `null`               |
| `editor`                | `{ fontSize 10–28, tabSize 2/4/8, wordWrap, minimap }` | `14, 2, true, false` |
| `recentToolIds`         | string[] (unique, max 10, most recent first)           | `[]`                 |

Other localStorage keys (per-browser conveniences, all optional and validated on read):

| Key                          | Purpose                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `devstudio:options:<toolId>` | Remembered tool options (e.g. indentation, delimiter). Only known keys with the default's type are accepted |
| `devstudio:split:<toolId>`   | Remembered split-pane ratio                                                                                 |

Loading is defensive: parsing uses `safeJsonParse` (which strips `__proto__`/`constructor`/`prototype`),
and each field falls back to its default individually when invalid. Storage that is unavailable
or full never breaks the app.

## Sensitive data policy

- No passwords or API credentials are stored in this phase.
- From Phase 10: environment variables marked `secret` and auth credentials stay in memory unless
  the user explicitly opts in per environment (`persistSecrets`), with optional passphrase
  encryption (WebCrypto AES-GCM). Backups exclude secrets unless explicitly included.
