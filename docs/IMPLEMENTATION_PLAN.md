# DevStudio — Phase 1: Architecture & Implementation Plan

Status: **Approved. Phases 1–8 delivered (v0.6.0).** Next: Phase 9 (SQL Tools).
Date: 2026-11-11

---

## 0. Project directory inspection

| Item                      | Finding                                    |
| ------------------------- | ------------------------------------------ |
| Repository                | Empty git repository; no commits, no files |
| Branch                    | `ccr-83e432d5-kxs16h`                      |
| Runtime                   | Node 22.23, npm 10.9                       |
| Existing code to preserve | None. This is a greenfield project         |

All dependency versions below were checked against the npm registry on 2026-11-11, including peer dependency ranges.

---

## 1. System architecture

DevStudio is a **static single-page application (SPA)**. There is no backend. Everything runs in the browser:

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Browser (SPA)                              │
│                                                                      │
│  ┌───────────── App Shell (always loaded, ~small) ────────────────┐  │
│  │ ThemeProvider · Router · ErrorBoundary · NotificationSystem    │  │
│  │ AppLayout: Sidebar · TopBar · Breadcrumbs · CommandPalette     │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │ React.lazy() per route               │
│  ┌──────────┬──────────┬──────┴────┬──────────┬──────────┬────────┐  │
│  │Dashboard │ API      │ JSON      │ CodeGen  │ SQL      │ Utils  │  │
│  │          │ Studio   │ Studio    │          │ Toolkit  │ Text   │  │
│  │          │          │           │          │          │Snippets│  │
│  └────┬─────┴────┬─────┴─────┬─────┴────┬─────┴────┬─────┴───┬────┘  │
│       │ feature hooks (useX) — presentation never touches storage│    │
│  ┌────▼──────────▼───────────▼──────────▼──────────▼─────────▼────┐  │
│  │  Zustand stores (UI/session state)   ·  Services (pure logic)  │  │
│  └────┬────────────────────────────┬──────────────────┬───────────┘  │
│       │                            │                  │              │
│  ┌────▼──────────────┐   ┌─────────▼─────────┐  ┌─────▼────────────┐ │
│  │ Storage layer     │   │ Worker pool       │  │ HTTP client      │ │
│  │ Repositories over │   │ (Comlink-style    │  │ fetch() wrapper  │ │
│  │ Dexie (IndexedDB) │   │ typed RPC):       │  │ timing, size,    │ │
│  │ + prefs over      │   │ json, diff, csv,  │  │ abort, CORS err  │ │
│  │ localStorage      │   │ schema, sql.js    │  │ classification   │ │
│  └───────────────────┘   └───────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
          Network traffic leaves the browser only when the user
          sends an API request (API Studio, OAuth token exchange).
```

### 1.1 Layering rules (enforced by ESLint `no-restricted-imports`)

1. **`core/`**: framework-agnostic pure TypeScript (parsers, generators, converters). No React, no Dexie, no DOM. Fully unit-testable and usable inside workers.
2. **`services/`**: side-effecting infrastructure: database, preferences, HTTP, workers, file I/O, clipboard. No React.
3. **`features/<module>/`**: one folder per module. Contains pages, feature components, hooks, and stores. May import from `core`, `services`, `components`, `hooks`. **Features may not import from other features.** Shared needs move to `core` or `components`. This prevents duplicated functionality: for example, JSON→CSV exists once in `core/converters` and is used by both JSON Studio and Code Generators.
4. **`components/`**: reusable presentational UI. No direct storage access.
5. **Pages are thin.** They compose components and call feature hooks. Business logic lives in `core` and hooks.

### 1.2 Cross-cutting concerns

| Concern          | Approach                                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error handling   | `AppError` class hierarchy (`ValidationError`, `ParseError`, `NetworkError`, `CorsError`, `StorageQuotaError`, `WorkerError`) + `toUserMessage()`; route-level `ErrorBoundary`; `useAsyncAction` hook surfaces errors through `NotificationSystem` |
| Tool registry    | One `toolRegistry.ts` declares every tool: id, title, module, route, icon, keywords, description. The sidebar, command palette, dashboard, breadcrumbs, favorites, and usage stats all derive from it, so there is one source of truth             |
| Heavy processing | Payloads over ~1 MB (configurable), plus diff, CSV, schema, and sql.js work, go through `workerClient.run(task, payload)` with progress, cancellation (`AbortSignal` → `worker.terminate()`), and fallback to the main thread for small inputs     |
| History          | `historyService.record({toolId, input, output, meta})` called from tool hooks. It is debounced, size-capped (inputs truncated beyond 256 KB), and gives one-click restore through the route + `?restore=<id>`                                      |
| Theming          | MUI `createTheme` with light/dark tokens, Monaco themes synced to the MUI palette, and the system preference as default                                                                                                                            |
| Shortcuts        | A central `shortcutRegistry` with `useHotkey()`. A help dialog lists all registered shortcuts                                                                                                                                                      |

---

## 2. Proposed folder structure

```
DevStudio/
├── .github/workflows/ci.yml          # lint, typecheck, unit, e2e, build
├── docs/                             # ARCHITECTURE, DATABASE_SCHEMA, FEATURE_LIST,
│                                     # TESTING, DEPLOYMENT, IMPLEMENTATION_PLAN
├── e2e/                              # Playwright specs + fixtures
├── public/                           # favicon, sql-wasm.wasm (copied at build)
├── src/
│   ├── main.tsx                      # bootstrap only
│   ├── app/
│   │   ├── App.tsx                   # providers + router outlet (thin)
│   │   ├── providers/                # ThemeProvider, NotificationProvider, ...
│   │   ├── router/                   # routes.tsx (lazy), RouteErrorBoundary
│   │   ├── layout/                   # AppLayout, Sidebar, TopBar, Breadcrumbs
│   │   └── command-palette/          # CommandPalette, search index, providers
│   ├── components/                   # reusable UI (see §2.1)
│   ├── core/                         # pure logic, worker-safe
│   │   ├── json/                     # format, validate (w/ error position), diff,
│   │   │                             # flatten, sortKeys, search, path-finder
│   │   ├── schema/                   # infer JSON Schema, validate (ajv)
│   │   ├── codegen/
│   │   │   ├── model/                # JSON → intermediate type model (shared)
│   │   │   ├── emitters/             # csharp, typescript, java, python, sql
│   │   │   └── naming.ts             # PascalCase/camelCase/snake, reserved words
│   │   ├── converters/               # csv⇄json, xml⇄json, yaml, base64, url, html
│   │   ├── sql/                      # format, minify, validate (parser), generators,
│   │   │                             # dialects, schema→DDL, sql→C#/TS
│   │   ├── crypto/                   # hashes, secure random, uuid, jwt decode/verify
│   │   ├── text/                     # diff, case, counters, line ops, lorem
│   │   ├── datetime/                 # timestamp/timezone/diff helpers
│   │   ├── http/                     # request model, variable interpolation,
│   │   │                             # assertions engine, chaining extractors
│   │   └── security/                 # safeJsonParse (proto-pollution guard),
│   │                                 # sanitizeHtml, file validation
│   ├── services/
│   │   ├── db/                       # Dexie schema, migrations, repositories
│   │   ├── preferences/              # typed localStorage wrapper
│   │   ├── http/                     # fetch executor, CORS classification
│   │   ├── workers/                  # worker pool + typed RPC client
│   │   ├── backup/                   # export/import all data (JSZip)
│   │   ├── history/                  # historyService
│   │   └── files/                    # upload/download/drag-drop helpers
│   ├── workers/                      # *.worker.ts entry points
│   ├── features/
│   │   ├── dashboard/
│   │   ├── api-studio/
│   │   ├── json-studio/
│   │   ├── code-generators/
│   │   ├── sql-toolkit/
│   │   ├── dev-utilities/
│   │   ├── text-tools/
│   │   ├── snippets/
│   │   ├── history/
│   │   ├── favorites/
│   │   └── settings/
│   │       # each: pages/, components/, hooks/, store.ts, index.ts, *.test.tsx
│   ├── hooks/                        # useDebounce, useHotkey, useAsyncAction,
│   │                                 # useLiveQuery wrappers, useFileDrop, ...
│   ├── stores/                       # global Zustand: ui (sidebar, palette), recent
│   ├── tools/toolRegistry.ts         # single source of truth for all tools
│   ├── theme/                        # tokens, mui theme, monaco themes
│   ├── types/                        # shared domain types
│   └── test/                         # setup, fake-indexeddb, render helpers
├── CLAUDE.md  README.md  CHANGELOG.md
├── index.html                        # CSP meta (dev); headers via vercel.json
├── vercel.json                       # CSP + security headers, SPA rewrites
├── vite.config.ts  vitest.config.ts  playwright.config.ts
├── eslint.config.js  .prettierrc  tsconfig*.json
```

### 2.1 Reusable components (`src/components/`)

| Component                                  | Notes                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `CodeEditor`                               | Lazy-loaded Monaco wrapper: language, theme sync, readOnly, error markers (`markers` prop → line/col), `onMount` hooks, editor prefs |
| `DiffEditor`                               | Monaco diff editor wrapper (side-by-side / inline toggle)                                                                            |
| `JsonViewer`                               | Virtualized tree (expand/collapse all, copy path, copy value, search highlight). Handles ~100k nodes through flattened virtual rows  |
| `DataGrid`                                 | Virtualized table (`@tanstack/react-virtual`) with sort, filter, column resize, and CSV export                                       |
| `SearchInput`                              | Debounced, with clear button and shortcut hint                                                                                       |
| `ToolHeader`                               | Title, description, favorite toggle, contextual action slot                                                                          |
| `ToolSidebar`                              | Secondary nav inside a module (e.g. JSON Studio's 16 tools)                                                                          |
| `SplitPane`                                | Resizable horizontal/vertical, keyboard-adjustable, persisted ratio                                                                  |
| `CopyButton` / `DownloadButton`            | Feedback toast; download via FileSaver with MIME type                                                                                |
| `FileDropZone`                             | Drag-drop + picker, validates size/type/extension                                                                                    |
| `EmptyState`, `LoadingState`, `ErrorState` | Consistent states                                                                                                                    |
| `ErrorBoundary`                            | Reset key + "report details" copy                                                                                                    |
| `ConfirmationDialog`                       | Promise-based `confirm()` via hook                                                                                                   |
| `NotificationSystem`                       | Queue of toasts (success/info/warning/error), `useNotify()`                                                                          |
| `KeyValueEditor`                           | Used by headers, params, form data, env variables (enable toggle, bulk edit)                                                         |

---

## 3. Dependency list (verified compatible)

### 3.1 Runtime

| Package                                        | Version          | Purpose / note                                                                                |
| ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| react, react-dom                               | ^19.2            | Required by react-router 8 (peer `>=19.2.7`)                                                  |
| react-router                                   | ^8.5             | Data router, `lazy` routes                                                                    |
| @mui/material, @emotion/react, @emotion/styled | ^9.5             | Peer: React 17–19 ✔                                                                           |
| @mui/x-tree-view                               | (optional)       | **Not planned.** The custom virtualized JsonViewer scales better                              |
| iconsax-reactjs                                | 0.0.8            | **Risk R1.** See §8. Maintained React 19 fork of `iconsax-react`                              |
| zustand                                        | ^5.1             | UI/session state                                                                              |
| dexie, dexie-react-hooks                       | ^4.4             | IndexedDB + `useLiveQuery`                                                                    |
| monaco-editor, @monaco-editor/react            | 0.5x / ^4.7      | Self-hosted (no CDN loader, so it is CSP-safe and works offline)                              |
| echarts, echarts-for-react                     | ^6.1 / ^3.0      | Dashboard stats, schema relationship graph. Tree-shaken `echarts/core` imports                |
| react-hook-form, @hookform/resolvers, zod      | ^7.9 / ^7 / ^4.6 | Forms + import validation (one schema lib: **Zod**)                                           |
| @tanstack/react-virtual                        | ^3.14            | List and tree virtualization                                                                  |
| jszip, file-saver                              | ^3.10 / ^2.0     | Backups, multi-file codegen download                                                          |
| papaparse                                      | ^5.7             | CSV ⇄ JSON                                                                                    |
| date-fns, @date-fns/tz                         | ^4.4             | Date tools, IANA timezone conversion                                                          |
| uuid                                           | ^14              | v1/v4/v5/v7 generation                                                                        |
| crypto-js                                      | ^4.2             | **MD5 and SHA-1 only** (missing from WebCrypto). SHA-256/384/512 and HMAC use `crypto.subtle` |
| jose                                           | ^6.2             | JWT signature verification (HS*, RS*, PS*, ES*, EdDSA) with supplied keys/JWKS                |
| ajv, ajv-formats                               | ^8.20            | JSON Schema validation (draft-07 / 2019-09 / 2020-12)                                         |
| jsonpath-plus                                  | ^11.3            | JSONPath evaluation. **Configured with `eval: false`** (see R5)                               |
| node-sql-parser                                | ^5.4             | SQL validation / AST per dialect                                                              |
| sql-formatter                                  | ^15.9            | SQL formatting per dialect                                                                    |
| sql.js                                         | ^1.16            | SQLite WASM for local execution                                                               |
| diff (jsdiff)                                  | ^9               | Line/word diff outside Monaco (text compare stats, JSON compare)                              |
| fast-xml-parser                                | ^5.12            | XML ⇄ JSON, XML formatting/validation                                                         |
| yaml                                           | ^2.9             | YAML format/validate                                                                          |
| marked, dompurify                              | ^18 / ^3.4       | Markdown preview, sanitized output                                                            |
| cronstrue, cron-parser                         | ^3 / ^5          | Cron description and next-run times                                                           |
| ua-parser-js                                   | ^2.0             | User agent parsing (MIT-licensed build)                                                       |
| mime (`mime/lite`)                             | ^4               | MIME type lookup                                                                              |
| comlink                                        | ^4.4             | Typed worker RPC                                                                              |

### 3.2 Development

| Package                                                                        | Version                                        | Note                                                                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| vite, @vitejs/plugin-react                                                     | ^8.3 / ^6.3                                    |                                                                                                                  |
| **typescript**                                                                 | **~6.0.3**                                     | **Pinned below 7.** `typescript-eslint` 8.x peer is `>=4.8.4 <6.1.0`, and TS 7 (native) isn't supported yet (R2) |
| typescript-eslint, eslint, @eslint/js                                          | ^8.72 / **^9.39**                              | Flat config, `strictTypeChecked`. ESLint 9, because eslint-plugin-jsx-a11y doesn't support 10 yet                |
| eslint-plugin-react-hooks, eslint-plugin-react-refresh, eslint-plugin-jsx-a11y | latest stable                                  |                                                                                                                  |
| prettier, eslint-config-prettier                                               | ^3.10                                          |                                                                                                                  |
| vitest, @vitest/coverage-v8, jsdom                                             | ^5.1                                           |                                                                                                                  |
| @testing-library/react, /dom, /user-event, /jest-dom                           | ^16.3 / ^10 / ^14 / ^6                         |                                                                                                                  |
| fake-indexeddb                                                                 | ^6                                             | Dexie tests in jsdom                                                                                             |
| @playwright/test                                                               | Matches the pre-installed Chromium (1.5x/1.6x) |                                                                                                                  |
| msw                                                                            | ^2                                             | Mock HTTP for API Studio unit/e2e tests                                                                          |

Install policy: exact versions in the lockfile, `npm ci` in CI, `npm ls` to confirm no peer conflicts after install, and no `--legacy-peer-deps`. Packages published within the last two weeks (e.g. today's `monaco-editor` release) are pinned to the previous stable release.

---

## 4. IndexedDB schema (Dexie, database `devstudio`)

All records share a base shape: `id: string (uuid v7, time-sortable)`, `createdAt: number`, `updatedAt: number`. In Dexie index syntax, `&` is unique, `*` is multi-entry, and `[a+b]` is compound.

| Table                 | Indexes                                                                        | Key fields                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections`         | `id, name, updatedAt`                                                          | name, description, folders: `FolderNode[]` (tree of ids), order, auth (inherited), variables                                                   |
| `apiRequests`         | `id, collectionId, folderId, name, method, updatedAt, [collectionId+folderId]` | method, url, params[], headers[], auth, body {mode: none/json/raw/urlencoded/multipart, …}, assertions[], extractors[] (chaining), description |
| `environments`        | `id, &name, updatedAt`                                                         | name, variables: `{key, value, secret: boolean, enabled}[]`, isBuiltIn (Dev/Test/Staging/Prod)                                                 |
| `apiHistory`          | `id, requestId, method, status, createdAt, url`                                | request snapshot, response {status, headers, bodyPreview (≤1 MB), size, timeMs}, assertion results                                             |
| `jsonDocuments`       | `id, name, *tags, updatedAt`                                                   | name, content, size, tags                                                                                                                      |
| `savedQueries`        | `id, name, dialect, kind, *tags, updatedAt`                                    | kind: `query` / `schema` / `sqliteDb`, content (SQL text, schema-designer JSON model, or sqlite `Uint8Array` for local DB persistence)         |
| `codeSnippets`        | `id, title, language, category, *tags, isFavorite, updatedAt`                  | title, description, code, language, category, tags, isFavorite                                                                                 |
| `favorites`           | `id, &[entityType+entityId], entityType, createdAt`                            | entityType: `tool` / `request` / `snippet` / `document` / `query`, entityId, order                                                             |
| `toolHistory`         | `id, toolId, createdAt, [toolId+createdAt]`                                    | toolId, label, input (truncated), output (truncated), options, durationMs                                                                      |
| `settings`            | `key` (primary key = key string)                                               | Larger settings (quick-access layout, snippet categories, codegen defaults, secret-storage consent flag)                                       |
| `toolUsage` _(added)_ | `toolId, count, lastUsedAt`                                                    | Aggregated counters for dashboard stats. Cheaper than scanning history                                                                         |

**Versioning & migrations**

- `db.version(1).stores({...})` defines the initial schema. Every later change adds `db.version(n).stores(...).upgrade(tx => ...)`. Old versions are never edited.
- Migrations are covered by a test that opens v1 with seed data, upgrades, and asserts the result (with fake-indexeddb).
- A repository layer (`snippetRepository.search(q)`, etc.) hides Dexie from features and makes the storage replaceable/mocked in tests.

**Quota & resilience**

- All writes go through `safeWrite()`, which catches `QuotaExceededError` (including Dexie's wrapped variant) → `StorageQuotaError` → a user notification with a "free space" action (clear history / large docs).
- `navigator.storage.estimate()` is shown in Settings. `navigator.storage.persist()` is requested on demand.
- History pruning: configurable cap (default 1,000 entries per table, 90 days).

**Secrets policy**

- Environment variables marked `secret`, and auth credentials, are **not persisted by default**. They live in memory for the session only.
- The user can opt in per environment ("Remember secrets on this device"). The consent dialog explains plaintext IndexedDB storage. Optional at-rest encryption uses a user passphrase (WebCrypto AES-GCM + PBKDF2). Without the passphrase, values stay in memory only.
- Backups exclude secrets unless the user explicitly ticks "include secrets".

**localStorage (prefs only, key `devstudio:prefs:v1`, Zod-validated)**: theme, sidebarCollapsed, selectedEnvironmentId, editor {fontSize, wordWrap, minimap, tabSize}, recentToolIds (≤10).

**Backup/restore**: export as a `.zip` (JSZip) containing `manifest.json` (app/db version, counts, checksum) + one JSON file per table. Import validates with Zod per table, uses `safeJsonParse`, offers _merge_ or _replace_, runs inside a single Dexie transaction, and migrates older backup versions.

---

## 5. Navigation structure

```
/                                   Dashboard
/api                                API Testing Studio
  /api/requests/:requestId?           workspace (collections tree | request | response)
  /api/environments                   environment manager
  /api/runner/:collectionId           collection test runner
  /api/history                        request history + response comparison
/json/:tool                         JSON Studio
  formatter · validator · minifier · tree · compare · path-finder · jsonpath
  · schema-generate · schema-validate · flatten · unflatten · search · sort-keys
  · to-csv · from-csv          (Beautifier = Formatter w/ options; listed as alias)
/codegen/:generator                 Code Generators
  csharp · typescript · java · python · sql-table · json-to-xml · xml-to-json · json-to-csv*
/sql/:tool                          SQL Toolkit
  formatter · minifier · validator · query-builder (SELECT/INSERT/UPDATE/DELETE)
  · to-csharp · to-typescript · compare · schema-designer · playground (sql.js)
/utils/:tool                        Developer Utilities
  encoding: base64 · url · html-entities
  token:    jwt (decode · header · payload · expiry · verify)
  generate: uuid (incl. GUID formats) · random-string · password · hash · lorem
  time:     timestamp · timezone · date-diff
  other:    color · cron · mime · user-agent
/text/:tool                         Text & Code Tools
  diff (text/code via Monaco) · find-replace · counter (words/chars/lines)
  · line-tools (dedupe/sort/reverse) · case · markdown · html-preview · xml · yaml
/snippets/:snippetId?               Snippet Manager
/history                            Unified tool history
/favorites                          Favorites
/settings/:section?                 appearance · editor · data (backup/restore/quota) · shortcuts · about
```

\* `json-to-csv` is registered once (core converter) and exposed in both JSON Studio and Code Generators through the tool registry alias, without duplicating code.

Every leaf is a lazy route chunk. Each module has its own `ToolSidebar`. Breadcrumbs derive from the registry (`Module › Tool`). Unknown routes show a 404 `EmptyState` with search.

**Global keyboard shortcuts**: `Ctrl/⌘+K` command palette · `Ctrl/⌘+B` toggle sidebar · `Ctrl/⌘+Shift+L` theme · `Ctrl/⌘+Enter` run current tool / send request · `Ctrl/⌘+S` save current entity · `?` shortcut help · `Alt+1..9` quick-access tools.

**Command palette** sources: tools (static index), saved requests, JSON documents, SQL queries, snippets, history. It runs debounced (150 ms) Dexie indexed-prefix queries plus an in-memory fuzzy score, groups results by type, and supports keyboard navigation (↑↓, Enter, Tab to switch group) and `>` prefix for actions (toggle theme, new snippet, export data…).

---

## 6. Development roadmap

Each phase ends with: `tsc --noEmit` ✔, `eslint` ✔, relevant Vitest/RTL tests ✔, Playwright smoke for new routes ✔, docs + CHANGELOG updated, a commit + push, and a completion report listing anything deferred.

| Phase  | Scope                                    | Key deliverables                                                                                                                                                                                                                                                            | Tests highlight                                                             |
| ------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **2**  | Scaffold                                 | Vite+React+TS strict, ESLint/Prettier, Vitest/RTL/Playwright configs, CI workflow, folder skeleton, Dexie v1 schema + repositories, prefs service, worker pool, error model, doc stubs                                                                                      | db open/migrate, prefs validation                                           |
| **3**  | Shell, theme, routing, search, dashboard | AppLayout (collapsible/responsive sidebar, mobile drawer), TopBar, breadcrumbs, theme switch + persistence, tool registry, command palette, shortcuts dialog, recent tools, Dashboard (stats via ECharts, favorites, quick-access customization), reusable components set   | theme persistence, palette keyboard nav, registry integrity                 |
| **4**  | JSON Studio                              | All 16 tools, error line markers, upload/drag-drop, virtualized tree, structural diff (missing props / type diffs), schema gen + ajv validation, worker offload, saved documents                                                                                            | format/validate/compare edge cases, large-file worker path                  |
| **5**  | Code Generators                          | Shared type-inference model (merges array element shapes → optional/nullable detection), emitters C#/TS/Java/Python/SQL, XML⇄JSON, options panels, zip download                                                                                                             | C# spec example, nullable/list/dict/nested, reserved words, name collisions |
| **6**  | Developer Utilities                      | 25+ utilities. JWT verify via jose with PEM/JWK/JWKS/secret input. Secure random via `crypto.getRandomValues`                                                                                                                                                               | Base64 unicode, JWT malformed/expired, verify true/false                    |
| **7**  | Text & Code Tools                        | Monaco diff, line tools, case converter, sanitized Markdown/HTML preview (sandboxed iframe), XML/YAML formatters                                                                                                                                                            | sanitization (XSS payload corpus)                                           |
| **8**  | Snippet Manager                          | CRUD, tags, categories, favorites, search, import/export (validated)                                                                                                                                                                                                        | persistence, import rejection                                               |
| **9**  | SQL Toolkit                              | Format/minify/validate (parser AST per dialect), CRUD generators, SQL→C#/TS, compare, Schema Designer (ECharts graph + DDL per dialect), sql.js playground with IndexedDB-persisted DB files                                                                                | dialect DDL snapshots, parser errors                                        |
| **10** | API Studio                               | Request builder, all body modes, auth (None/Basic/Bearer/API key/OAuth2 PKCE + client credentials), environments + `{{var}}` interpolation, collections/folders CRUD, import/export (native + Postman v2.1 import), assertions, chaining, runner, history, response compare | executor with msw, CORS error classification, interpolation                 |
| **11** | History, Favorites, Backup               | Unified history page (search/delete/clear/restore), favorites page, full backup/restore, quota UI                                                                                                                                                                           | export→import round-trip                                                    |
| **12** | Hardening                                | Security review (CSP, sanitization, proto-pollution, file validation), perf (bundle analysis, budgets), a11y pass, coverage gaps, full Playwright suite                                                                                                                     | e2e across modules                                                          |
| **13** | Deployment                               | `vercel.json` headers, GitHub Actions deploy, preview builds, final docs                                                                                                                                                                                                    | prod build smoke                                                            |

Order follows your workflow. It front-loads the shared foundation (codegen type model, KeyValueEditor, JsonViewer, worker pool) so later modules reuse it.

---

## 7. Security design (summary)

| Requirement            | Implementation                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No embedded secrets    | No API keys in source. `.env` not used for secrets. CI secret scanning                                                                                                                                                                                                                                                   |
| Sanitize HTML          | DOMPurify for Markdown output. HTML Preview renders in `<iframe sandbox="">` (no `allow-scripts`) via `srcdoc` of sanitized markup                                                                                                                                                                                       |
| No eval / new Function | ESLint `no-eval`, `no-new-func`, `no-implied-eval`. jsonpath-plus with `eval: false`. Monaco runs without `unsafe-eval`                                                                                                                                                                                                  |
| CSP                    | `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'` (Emotion/Monaco need inline styles); `connect-src *` (required for API Studio, which is user-invoked only); `frame-src 'self' blob:`; `object-src 'none'; base-uri 'self'; frame-ancestors 'none'` |
| Prototype pollution    | `safeJsonParse` reviver drops `__proto__`/`constructor`/`prototype` keys on imports. Flatten/unflatten and merge use `Object.create(null)`/`Map` and reject those path segments                                                                                                                                          |
| File validation        | Extension + MIME + size limits (default 50 MB JSON, 200 MB SQLite) + content sniffing before parsing                                                                                                                                                                                                                     |
| Imported data          | Zod schemas for backups, collections, snippets, environments                                                                                                                                                                                                                                                             |
| CORS                   | Not bypassed. A failed fetch with no response is classified as a "likely CORS/network" error, with guidance (server must send `Access-Control-Allow-Origin`, or use a local dev proxy the user controls)                                                                                                                 |

---

## 8. Technical risks & mitigations

| #   | Risk                                                                                                                                                                     | Impact                                       | Mitigation                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **Iconsax React package health.** `iconsax-react` was last published in 2022 and relies on React patterns that may warn under React 19. `iconsax-reactjs` is a 2025 fork | Icons broken or console warnings             | Use `iconsax-reactjs`. Wrap all icons behind `src/components/icons.ts` re-exports so the package can be swapped in one file. Verify in Phase 2 with a React 19 render test                                                                                                                       |
| R2  | **TypeScript 7 vs tooling.** TS 7 (native Go compiler) is `latest`, but typescript-eslint supports `<6.1`                                                                | Lint pipeline breaks                         | Pin TypeScript `~6.0.3` and revisit when typescript-eslint adds support                                                                                                                                                                                                                          |
| R3  | **Monaco bundle size and workers.** ~3–5 MB, with language workers                                                                                                       | Slow first load                              | Lazy-load only inside tool routes. Self-host via `?worker` imports. Restrict languages to those used. Preload on hover/idle                                                                                                                                                                      |
| R4  | **CORS** blocks many public APIs from a browser client                                                                                                                   | API Studio "doesn't work" for some endpoints | Clear error classification + docs. No proxy built in (per requirements). Optional user-configured proxy URL field, off by default and clearly labeled                                                                                                                                            |
| R5  | **JSONPath libraries** historically used `eval` for filter expressions                                                                                                   | CSP violation / code injection               | jsonpath-plus with `eval: false` (its safe evaluator). Covered by tests that confirm no `eval` under CSP in e2e                                                                                                                                                                                  |
| R6  | **SQL parser coverage.** node-sql-parser doesn't support every dialect-specific feature (T-SQL `MERGE`, CTE variants)                                                    | False "invalid" results                      | Present results as "parser could not parse" with location. Allow dialect switching. Document unsupported constructs. Validation results never block formatting                                                                                                                                   |
| R7  | **sql.js WASM** needs `wasm-unsafe-eval` in CSP and a hosted `.wasm`                                                                                                     | Playground fails under strict CSP            | Serve the wasm from `/`, allow `'wasm-unsafe-eval'` only (not `unsafe-eval`), and lazy-load only on the playground route                                                                                                                                                                         |
| R8  | **Large JSON** (50 MB+) freezes the main thread and Monaco                                                                                                               | Unresponsive UI                              | Worker parsing/formatting. Above a threshold, Monaco switches to a read-only "large file mode" (no folding/minimap/validation), and the tree view is virtualized                                                                                                                                 |
| R9  | **OAuth 2.0 in a pure SPA.** Implicit flow is deprecated, and many providers block CORS on the token endpoint or require a client secret                                 | Partial support only                         | Support Authorization Code + **PKCE** (popup + `postMessage` to `/oauth/callback`) and Client Credentials. Document that providers must allow CORS on the token endpoint, and that confidential-client flows that need a secret aren't safe in a browser. Manual token paste is always available |
| R10 | **Credential storage** in IndexedDB is plaintext                                                                                                                         | Credential leakage                           | Secrets live in memory by default, with opt-in persistence + optional passphrase encryption (§4)                                                                                                                                                                                                 |
| R11 | **Browser storage eviction**                                                                                                                                             | Data loss                                    | `navigator.storage.persist()` prompt, backup reminders, export                                                                                                                                                                                                                                   |
| R12 | **Multipart / forbidden headers.** Browsers forbid setting `Cookie`, `Host`, `Content-Length`, etc.                                                                      | User confusion                               | Detect forbidden headers, show an inline warning, and don't silently drop them                                                                                                                                                                                                                   |
| R13 | **Scope size** (~100 tools)                                                                                                                                              | Schedule / quality                           | Strict phase gates. Shared core (one type model drives five emitters). Registry-driven UI avoids per-tool boilerplate                                                                                                                                                                            |
| R14 | **JWT verify algorithms.** jose supports a fixed set; WebCrypto has no secp256k1 (ES256K)                                                                                | Some tokens can't be verified                | Report "unsupported algorithm" explicitly. Never show "verified" unless jose returns success. `alg: none` is always rejected                                                                                                                                                                     |

---

## 9. Testing strategy (summary; full detail goes in TESTING.md in Phase 2)

- **Unit (Vitest)**: all of `core/` gets edge-case and malformed-input suites, with a coverage target ≥ 90% on `core/`.
- **Component (RTL)**: reusable components + each tool page's primary interactions.
- **Persistence**: Dexie repositories with `fake-indexeddb`, plus migration tests.
- **HTTP**: executor tested with msw (status, headers, timing, size, abort, network error → CORS classification).
- **E2E (Playwright, Chromium)**: navigation, palette, theme persistence across reload, one golden path per module, backup round-trip, CSP violation listener (fails the test on any CSP report).
- CI gate: typecheck, lint, unit+component, build, e2e against `vite preview`.

---

## 10. Decisions (resolved)

Implementation proceeded with the recommended options:

1. **Icons**: `iconsax-reactjs` (maintained fork), wrapped behind registry icons and `ToolIcon`. ✅
2. **TypeScript ~6.0** pinned for typescript-eslint compatibility. ✅
3. **Zod only** (no Yup). ✅
4. **Secrets in memory by default**, with opt-in persistence (implemented in Phase 10). ✅ (policy)
5. **Optional CORS proxy URL**: deferred to Phase 10. If added, it will be off by default and clearly labeled.
6. **Postman v2.1 import**: planned for Phase 10.

Deviation in Phase 4: **`@cfworker/json-schema` instead of Ajv** for JSON Schema validation. Ajv
compiles schemas with `new Function`, which the CSP (no `unsafe-eval`) blocks. `@cfworker/json-schema`
interprets schemas, supports drafts 4, 7, 2019-09 and 2020-12, and is pinned to the long-established
4.1.1 (several releases appeared within two weeks after a long quiet period, so as a supply-chain
precaution the newest version was not used). `jsonpath-plus` always runs with `eval: 'safe'`, its
sandboxed interpreter.

Deviation found during installation: **ESLint 9.39** instead of 10, because
`eslint-plugin-jsx-a11y@6.10` declares `eslint ^3–^9`. No peer dependency was forced.

## 11. Delivery log

| Phase                  | Result                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Architecture        | This document                                                                                                                                                                                                                       |
| 2. Scaffold            | Vite 8 / React 19 / TS 6 strict, ESLint layer rules, Prettier, Vitest, Playwright, CI, Dexie schema v1, preferences service                                                                                                         |
| 3. Shell and dashboard | Sidebar, top bar, routing, themes, command palette, shortcuts, dashboard, favorites, settings. 115 unit/component and 7 e2e tests passing                                                                                           |
| 4. JSON Studio         | 16 tools, Monaco (self-hosted, CSP-safe), worker pool with cancellation, virtualized tree and grid, saved documents, drafts, tool history. 275 unit/component and 13 e2e tests passing                                              |
| 5. Code Generators     | One type model, five emitters (C#, TS, Java, Python, SQL), XML ⇄ JSON, ZIP export, worker; shared workspace refactor. 346 unit/component and 16 e2e tests passing                                                                   |
| 6. Developer Utilities | 18 utilities; JWT verification (jose + Web Crypto: secret, PEM, JWK, JWKS), secure random, chunked file hashing, IANA time zones with DST notes. 454 unit/component and 20 e2e tests passing                                        |
| 7. Text Tools          | 11 tools; jsdiff, marked + DOMPurify (sandboxed previews, external resources blocked), token-level XML formatter, `yaml`; regex worker with timeout; shared text workspace with drafts. 555 unit/component and 25 e2e tests passing |
| 8. Snippet Manager     | CRUD, categories, tags, favorites, search, DevStudio/VS Code import and export, react-hook-form + Zod, unsaved-changes guards; fixed lost keystrokes in form-bound editors. 581 unit/component and 30 e2e tests passing             |
