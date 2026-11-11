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

## JSON Studio (✅ Phase 4)

All 16 tools share one working document (kept when switching tools, restored after reload),
Monaco editors, file open and drag-and-drop, Open/Save of named documents, Copy/Download, and
background processing for large inputs.

| Tool                | Highlights                                                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatter           | 2/4/tab indentation                                                                                                                                                                                                          |
| Validator           | RFC 8259 analyzer: precise line/column and friendly messages (trailing commas, single quotes, comments, unquoted keys, `NaN`/`undefined`, BOM…), error context with caret, duplicate-key warnings with locations, statistics |
| Minifier            | Size savings                                                                                                                                                                                                                 |
| Beautifier          | Short primitive arrays/objects inlined up to a width; optional key sorting                                                                                                                                                   |
| Tree Viewer         | Virtualized ARIA tree, keyboard navigation, expand all or by level, text highlight                                                                                                                                           |
| Compare             | Structural diff: missing/added properties, value changes, **type differences**; arrays by position or ignoring order; Monaco text diff of normalized (sorted) JSON; equality detection                                       |
| Path Finder         | Click any node: JSONPath, JavaScript accessor, JSON Pointer, value (all copyable)                                                                                                                                            |
| JSONPath Tester     | Filters, recursive descent, bracket keys; safe evaluator (no `eval`); table and JSON views                                                                                                                                   |
| Schema Generator    | Drafts 2020-12/2019-09/07, required inference across samples, nullable and mixed types, format detection (date-time, date, email, uri, uuid, ipv4), strict objects; "Validate with this schema"                              |
| Schema Validator    | Drafts 4/7/2019-09/2020-12 (auto from `$schema`), specific errors with JSONPath locations; no remote `$ref` fetching                                                                                                         |
| Flatten / Unflatten | Custom delimiter, `a.0` or `a[0]` notation, ambiguity warnings, conflict detection, prototype-pollution-safe                                                                                                                 |
| Search              | Keys and/or values, contains/exact/regex, case sensitivity; results grid reveals matches in the tree                                                                                                                         |
| Sort Keys           | Ascending/descending, natural numeric order, case-insensitive                                                                                                                                                                |
| JSON → CSV          | Flattened columns, arrays as JSON or expanded, delimiter, header, **formula-injection protection**                                                                                                                           |
| CSV → JSON          | Delimiter auto-detection, type conversion, nested objects from dotted headers, malformed-row reporting                                                                                                                       |

Cross-cutting:

- Inputs above 100 KB are processed in a **Web Worker**; above 1 MB processing is on demand
  (Run / `Ctrl+Enter`). Running work is cancelled when the input changes.
- Files are validated (type, 50 MB limit, binary detection, BOM removal).
- Saved documents are stored in IndexedDB and appear on the dashboard and in the command palette
  (`/json/formatter?document=<id>` deep links).
- Copy and Download record a tool-history entry (shown in the Phase 11 History page).
- Tool options and pane sizes are remembered per tool.

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
