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

## Code Generators (✅ Phase 5)

All generators read the **same JSON document** as JSON Studio (open/save/drafts included) and share
one language-neutral type model, so every language sees the same types:

- type inference across samples: int vs long, decimals with scale, booleans;
- ISO date-time/date and UUID detection;
- nullable and optional properties;
- unions for mixed types;
- dictionaries for objects keyed by ids or dates;
- identical structures merged into one class;
- name clashes resolved (`Item` → `OrderItem`).

| Generator         | Highlights                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON → C#         | Nullable reference types (`#nullable enable`, `string?`) and nullable value types (`int?`), `List<T>` / `IReadOnlyList<T>` / `T[]`, nested classes, `Dictionary<string, T>`, `[JsonPropertyName]` (System.Text.Json) or `[JsonProperty]` (Newtonsoft), always or only when names differ, PascalCase with unique and valid names, custom root class, namespace (file-scoped or block), automatic `using`s, class or record, `required` members, `double`/`decimal`, `DateTime`/`DateTimeOffset`/`string`, `Guid`; ZIP with one file per class |
| JSON → TypeScript | `interface` or `type`, optional `?` vs `\| null`, quoted non-identifier keys, `Record<string, T>`, unions, `readonly`, `T[]`/`Array<T>`, optional `Date`                                                                                                                                                                                                                                                                                                                                                                                     |
| JSON → Java       | Class with getters/setters, record (Java 16+) or Lombok; Jackson `@JsonProperty`; boxed types for nullable values; `java.time` and `UUID`; keyword escaping; one file with nested classes, or a ZIP with a package folder structure                                                                                                                                                                                                                                                                                                          |
| JSON → Python     | dataclasses (dependencies first, defaults last), Pydantic v2 (aliases + `populate_by_name`), TypedDict (functional syntax for non-identifier keys, `NotRequired`), `datetime`/`UUID`                                                                                                                                                                                                                                                                                                                                                         |
| JSON → SQL table  | SQL Server, PostgreSQL, MySQL, SQLite; primary key detection or surrogate identity; nested objects flattened or JSON columns; arrays as child tables with foreign keys (`ON DELETE CASCADE`) or JSON; lengths and precision inferred from data; reserved-word quoting; optional escaped INSERTs                                                                                                                                                                                                                                              |
| JSON → XML        | Single-key root detection, array wrapping, attributes via prefix, escaping, invalid names renamed and reported                                                                                                                                                                                                                                                                                                                                                                                                                               |
| XML → JSON        | Attributes, text nodes, repeated elements, typed values, "always arrays"; syntax errors with line/column; entity-expansion protection; "Use as JSON document"                                                                                                                                                                                                                                                                                                                                                                                |
| JSON → CSV        | Alias of JSON Studio's JSON → CSV (one implementation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

All generators run in a background worker for large inputs. Their output has Monaco syntax
highlighting (C#, TypeScript, Java, Python, SQL, XML), copy, download and history recording.

## Developer Utilities (✅ Phase 6)

Everything runs locally. Options are remembered per tool; **tokens, keys, secrets, HMAC keys and
generated passwords/strings are never stored** (not in localStorage, IndexedDB or history).

| Tool              | Highlights                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base64            | UTF-8 text, URL-safe alphabet, 64/76 line wrapping; tolerant decoding (whitespace, missing padding, data: URLs) with precise errors; binary output as hex dump + typed download; file → Base64 or data URL (10 MB) |
| URL encode/decode | Component, full-URL and form modes; `+` as space; URL parser (components, query parameters decoded, embedded-password warning)                                                                                     |
| HTML entities     | Minimal, non-ASCII named/numeric or all named entities; decodes every HTML5 named and numeric entity                                                                                                               |
| JWT decoder       | Accepts `Bearer` prefixes and quotes; coloured parts; header, payload, claims table with meanings and dates; expiry status; detects JWE; **always says the signature is not verified**                             |
| JWT verifier      | `jose` + Web Crypto: HMAC secret (text/Base64/hex), PEM public key or X.509 certificate, JWK or JWKS (`kid` selection); issuer, audience, clock tolerance; rejects `alg: none` and private keys                    |
| UUID / GUID       | v1, v4, v5 (namespaces), v6, v7, nil, max; bulk (1,000), uppercase, no hyphens; inspector (version, variant, embedded time); .NET `D N B P X` formats                                                              |
| Random string     | Presets (alphanumeric, hex, Base64URL, Crockford…) or custom characters; up to 4,096 × 1,000; uniform (rejection sampling)                                                                                         |
| Password          | Character classes, look-alike exclusion, excluded characters, at least one of each class, entropy in bits with strength meter                                                                                      |
| Hash              | MD5, SHA-1/224/256/384/512, Keccak-256/512, RIPEMD-160, HMAC; text or file (chunked, progress, cancel); hex/HEX/Base64; compare with an expected hash; weak algorithms flagged                                     |
| Lorem ipsum       | Paragraphs, sentences or words                                                                                                                                                                                     |
| Unix timestamp    | Live clock; seconds/ms/µs/ns auto-detection; ISO, RFC 2822, relative, calendar, any zone; date → timestamp                                                                                                         |
| Time zones        | Convert a wall time across a remembered list of IANA zones; offsets, abbreviations, DST badge, day shift, DST gap/overlap notes                                                                                    |
| Date difference   | Calendar difference (years…seconds), totals, business days, ISO 8601 duration, in any zone                                                                                                                         |
| Color             | HEX/HEX+alpha, rgb(), hsl() (comma and space syntax), named colors; HSV, CMYK; WCAG contrast on white, black and a custom background with AA/AAA ratings and a preview                                             |
| Cron              | 5- or 6-field expressions and `@` macros; plain-English description; field table; next 10 runs in any time zone; presets                                                                                           |
| MIME types        | Search ~1,000 IANA and vendor types by extension, file name or type                                                                                                                                                |
| User agent        | Browser, engine, OS, device, CPU, bots/tools; your browser's Client Hints when available                                                                                                                           |

## Text Tools (✅ Phase 7)

The find & replace, counter, line, reverse and case tools share one working text (kept when
switching tools and restored after a reload). Large inputs are processed in a Web Worker.

| Tool             | Highlights                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text Diff        | Side by side or inline; changed words or characters highlighted; ignore whitespace/case; unchanged regions collapsed with context; swap; unified diff (copy/download); virtualized                                              |
| Code Diff        | Monaco diff editor, 27 languages (detected from opened file names), inline/side by side, ignore leading/trailing whitespace, wrap                                                                                               |
| Find and Replace | Plain or regex (Unicode), match case, whole words, `^$` per line, `.` matches newlines; `$1` `$<name>` `$&`; `\n` `\t` escapes; match list (line, column, context); apply to text; regexes run in a worker with a 5 s limit     |
| Counter          | Words, unique words, characters with/without spaces (graphemes: 👍🏽 = 1), code points, UTF-16 units, UTF-8 bytes, sentences, paragraphs, lines, reading/speaking time, top words, character limits (SMS, X, LinkedIn…)           |
| Line Tools       | Trim, collapse spaces, remove empty, filter (keep/remove containing), dedupe (exact, ignore case/spaces, drop all repeated), sort (A–Z, natural, numeric, length, reverse, secure shuffle), prefix/suffix, numbering; CRLF kept |
| Reverse Text     | Characters (emoji and accents intact), word order, line order, letters in each word, each line                                                                                                                                  |
| Case Converter   | camelCase, PascalCase, snake_case, SCREAMING_SNAKE, kebab-case, COBOL-CASE, Train-Case, dot.case, path/case, lower, UPPER, Title, Sentence, aLtErNaTiNg, iNVERSE (acronym-aware, per line)                                      |
| Markdown Preview | GitHub-flavoured (tables, task lists, strikethrough), line breaks option, word count and reading time, generated HTML view, copy/download a standalone HTML file                                                                |
| HTML Preview     | Full documents with their `<style>`, viewport sizes (desktop/tablet/phone), sanitized source view, report of what was removed                                                                                                   |
| XML Formatter    | Format (2/4/tabs, attribute wrapping, self-closing) or minify; comments, CDATA, PIs, DOCTYPE, mixed content and `xml:space="preserve"` kept; errors with line/column; shares the XML with XML → JSON                            |
| YAML Formatter   | Format (comments and anchors kept, indent, quotes, wrapping, sort keys, list indentation), YAML → JSON (multi-document, merge keys), JSON → YAML from the shared JSON document; errors with line/column                         |

Previews are **sanitized** (no scripts, event handlers, `javascript:` URLs, frames or forms), never
load external resources, and render in a **sandboxed iframe** with its own Content Security Policy.

## Modules

70 tools are registered, searchable and favoritable. Tools of later phases show their delivery phase.

| Module                      | Tools                                                                                                                                                                                         | Phase |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| JSON Studio                 | Formatter, Validator, Minifier, Beautifier, Tree Viewer, Compare, Path Finder, JSONPath Tester, Schema Generator, Schema Validator, Flatten, Unflatten, Search, Sort Keys, JSON→CSV, CSV→JSON | ✅ 4  |
| Code Generators             | JSON → C#, TypeScript, Java, Python, SQL table, XML; XML → JSON; JSON → CSV (alias of JSON Studio's)                                                                                          | ✅ 5  |
| Developer Utilities         | Base64, URL, HTML entities, JWT decoder, JWT verifier, UUID, GUID, random string, password, hash, lorem ipsum, Unix timestamp, timezone, date diff, color, cron, MIME, user agent             | ✅ 6  |
| Text Tools                  | Text diff, code diff, find & replace, counters, line tools, reverse, case converter, Markdown preview, HTML preview, XML formatter, YAML formatter                                            | ✅ 7  |
| Snippet Manager             | CRUD, tags, categories, languages, favorites, search, import/export                                                                                                                           | 🗓 8   |
| SQL Tools                   | Formatter, minifier, validator, query/SELECT/INSERT/UPDATE/DELETE generators, SQL→C#, SQL→TS, compare, schema designer, SQLite playground                                                     | 🗓 9   |
| API Testing                 | Request builder, environments, collection runner, history, response compare                                                                                                                   | 🗓 10  |
| History, backup and restore | Unified history, restore, full export/import                                                                                                                                                  | 🗓 11  |

## Persistence (✅ foundation)

- Dexie schema v1 with all 11 tables and indexes; migration process documented.
- Repositories with atomic transactions; quota-aware `safeWrite`.
- Validated localStorage preferences (per-field fallback, prototype-pollution safe).
