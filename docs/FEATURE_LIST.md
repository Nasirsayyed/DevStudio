# Feature list

Legend: ✅ implemented and tested · 🗓 scheduled (roadmap phase in brackets)

## Application shell (✅)

| Feature                                                                            | Status | Tests                                                      |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| Collapsible sidebar (icon rail, tooltips, persisted)                               | ✅     | RTL + e2e (persists across reload)                         |
| Mobile navigation drawer (< 900 px)                                                | ✅     | e2e (390 px viewport, no horizontal scroll)                |
| Top bar: breadcrumbs, global search, recent tools, theme menu, shortcuts, settings | ✅     | RTL                                                        |
| Light / dark / system themes, persisted, synced to OS                              | ✅     | unit + RTL + e2e (persists across reload)                  |
| Lazy-loaded routes, per-page and per-tool code splitting                           | ✅     | build output                                               |
| 404 page with search, alias redirects, unknown-tool handling                       | ✅     | RTL + e2e                                                  |
| Error boundary (reset on navigation, copy details) + route error page              | ✅     | RTL                                                        |
| Toast notification queue, promise-based confirmation dialog                        | ✅     | RTL                                                        |
| Skip-to-content link, ARIA landmarks, labelled controls                            | ✅     | (queried by role in all tests)                             |
| Content Security Policy + security headers (preview and Vercel)                    | ✅     | unit (config ↔ vercel.json) + e2e (fails on any violation) |

## Global search and command palette (✅)

| Feature                                                                                | Status                            |
| -------------------------------------------------------------------------------------- | --------------------------------- |
| `Ctrl/⌘ K` palette with ARIA combobox/listbox and ↑ ↓ Home End Enter Esc               | ✅                                |
| Fuzzy tool search (title, keywords, module, description, module boost, recent boost)   | ✅                                |
| Searches saved requests, JSON documents, SQL scripts, snippets and history (IndexedDB) | ✅ (data appears as modules ship) |
| `>` action mode: navigate, theme, sidebar, shortcuts                                   | ✅                                |
| Keyboard shortcuts dialog (`?`), `Ctrl/⌘ B`, `Ctrl/⌘ Shift L`, `Alt 0–9`               | ✅                                |

## Dashboard (✅)

| Feature                                                                                                        | Status                                   |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Total tools available, per-module count                                                                        | ✅                                       |
| Counts of favorites, saved requests and collections, JSON docs, snippets and SQL scripts (live from IndexedDB) | ✅                                       |
| Quick access: customizable (choose and order up to 9), persisted, `Alt+1…9`                                    | ✅                                       |
| Recently used tools                                                                                            | ✅                                       |
| Favorite tools                                                                                                 | ✅                                       |
| Tool usage statistics (ECharts, lazy-loaded)                                                                   | ✅                                       |
| Recent API requests, saved JSON documents, saved snippets                                                      | ✅ (populate as Phases 4, 8 and 10 ship) |
| Inline global tool search                                                                                      | ✅                                       |

## Favorites (✅) and Settings (✅)

- Favorites page: list and remove favorite tools; browse and star any tool; favorites also toggle
  from every tool header.
- Settings: theme, sidebar mode, code-editor preferences (font size, tab size, word wrap, minimap;
  applied to editors from Phase 4), storage usage and quota, request persistent storage,
  reset usage statistics (with confirmation), and the about panel.

## Modules

70 tools are registered, searchable and favoritable now. Their pages show their delivery phase.

| Module                      | Tools                                                                                                                                                                                         | Phase |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| JSON Studio                 | Formatter, Validator, Minifier, Beautifier, Tree Viewer, Compare, Path Finder, JSONPath Tester, Schema Generator, Schema Validator, Flatten, Unflatten, Search, Sort Keys, JSON→CSV, CSV→JSON | 🗓 4   |
| Code Generators             | JSON → C#, TypeScript, Java, Python, SQL table, XML; XML → JSON; JSON → CSV (alias of JSON Studio's)                                                                                          | 🗓 5   |
| Developer Utilities         | Base64, URL, HTML entities, JWT decoder, JWT verifier, UUID, GUID, random string, password, hash, lorem ipsum, Unix timestamp, timezone, date diff, color, cron, MIME, user agent             | 🗓 6   |
| Text Tools                  | Text diff, code diff, find & replace, counters, line tools, reverse, case converter, Markdown preview, HTML preview, XML formatter, YAML formatter                                            | 🗓 7   |
| Snippet Manager             | CRUD, tags, categories, languages, favorites, search, import/export                                                                                                                           | 🗓 8   |
| SQL Tools                   | Formatter, minifier, validator, query/SELECT/INSERT/UPDATE/DELETE generators, SQL→C#, SQL→TS, compare, schema designer, SQLite playground                                                     | 🗓 9   |
| API Testing                 | Request builder, environments, collection runner, history, response compare                                                                                                                   | 🗓 10  |
| History, backup and restore | Unified history, restore, full export/import                                                                                                                                                  | 🗓 11  |

## Persistence (✅ foundation)

- Dexie schema v1 with all 11 tables and indexes; migration process documented.
- Repositories with atomic transactions; quota-aware `safeWrite`.
- Validated localStorage preferences (per-field fallback, prototype-pollution safe).
