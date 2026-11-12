# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-11-12

Text Tools (roadmap Phase 7).

### Added

- Text Diff: side-by-side or inline, changed words or characters highlighted, ignore whitespace
  and case, collapsible unchanged regions, swap, unified diff copy/download; large inputs are
  compared in a Web Worker with a time limit.
- Code Diff: Monaco diff editor with 27 languages (language picked from opened file names), inline
  or side by side, whitespace and wrap options.
- Find and Replace: plain text or regular expressions (Unicode, whole words, `^$` per line, dotAll),
  `$1`/`$<name>` replacements, `\n`/`\t` escapes, a match list with line, column and context,
  "Apply to text".
- Word & Character Counter (graphemes, code points, UTF-16 units, UTF-8 bytes, words, sentences,
  paragraphs, lines, reading/speaking time, top words, character limits), Line Tools (sort
  alphabetically/naturally/numerically/by length, secure shuffle, dedupe, trim, filter, prefix/
  suffix, numbering), Reverse Text (emoji-safe) and a Case Converter with 15 styles.
- Markdown Preview (GitHub-flavoured, copy/download HTML) and HTML Preview (viewport sizes), both
  sanitized and rendered in a sandboxed frame.
- XML Formatter (format/minify; comments, CDATA, DOCTYPE and mixed content kept; attribute
  wrapping) and YAML Formatter (format with comments kept, sort keys, YAML ⇄ JSON, multiple
  documents, merge keys).
- The working text of the Text Tools is shared between tools and kept as a draft. The XML Formatter
  shares its XML with XML → JSON, and JSON → YAML reads the JSON document.

### Changed

- Draft persistence is a reusable helper (`stores/draftPersistence.ts`), used by JSON Studio and
  Text Tools.
- Task runners accept `preferWorker` and `timeoutMs` (the worker is terminated on timeout).

### Security

- HTML from Markdown or pasted HTML is sanitized with DOMPurify: scripts, event handlers,
  `javascript:` URLs, frames, forms and `<base>`/`<meta>` are removed, form controls are disabled,
  and every external resource (images, CSS `url()`/`@import`, media) is blocked so previews never
  contact other servers. Previews run in a sandboxed iframe with its own restrictive CSP. A
  22-payload XSS corpus is part of the tests.
- User regular expressions run in a worker with a 5-second limit, so catastrophic backtracking
  cannot freeze the page.
- YAML alias expansion is capped (billion-laughs protection) and `__proto__`/`constructor` keys
  are dropped.

### Fixed

- A unified diff no longer reports the last line as changed when only a final newline differs.

## [0.4.0] - 2026-11-12

Developer Utilities (roadmap Phase 6).

### Added

- 18 utilities: Base64 (UTF-8, URL-safe, line wrapping, binary detection with hex dump and
  download, file → Base64/data URL), URL encode/decode with a URL and query-string parser, HTML
  entities, JWT decoder, JWT signature verifier, UUID (v1/v4/v5/v6/v7/nil/max, inspector), .NET
  GUID formats, random strings, passwords with entropy meter, hashes (MD5, SHA-1/224/256/384/512,
  Keccak, RIPEMD-160, HMAC, chunked file hashing with progress and cancel, compare), lorem ipsum,
  Unix timestamps (auto unit detection), time zone converter with DST notes, date difference
  (calendar, totals, business days, ISO 8601 duration), color converter with WCAG contrast, cron
  explainer with next runs in any time zone, MIME type lookup and User-Agent parser.
- JWT verification with `jose` and Web Crypto: HMAC secrets (text, Base64, hex), PEM public keys
  and X.509 certificates, JWK and JWKS, issuer/audience/clock-tolerance checks. The decoder always
  states that it has **not** verified the signature.

### Security

- Random values (passwords, strings, UUIDs, lorem) come from `crypto.getRandomValues` with
  rejection sampling (no modulo bias).
- Tokens, keys, secrets, HMAC keys and generated passwords/strings are never persisted or written
  to history. `alg: none`, private keys and PKCS#1 keys are refused by the verifier, and private
  JWK members are stripped.
- A verification result is tied to the exact inputs it was computed for; editing the token or key
  hides it.

### Fixed

- Number fields can be cleared and retyped (they used to snap to the minimum).

## [0.3.0] - 2026-11-11

Code Generators (roadmap Phase 5).

### Added

- JSON → C#: nullable reference/value types, lists, nested classes, dictionaries,
  `JsonPropertyName`/`JsonProperty`, PascalCase, root class name, namespace (file-scoped or block),
  automatic usings, class/record, `required` members, decimal/DateTimeOffset/Guid options, and a
  ZIP with one file per class.
- JSON → TypeScript, Java (class/record/Lombok, Jackson), Python (dataclass/Pydantic v2/TypedDict)
  and SQL tables (SQL Server/PostgreSQL/MySQL/SQLite, keys, child tables with foreign keys,
  JSON columns, INSERTs).
- JSON → XML and XML → JSON, with syntax errors located and entity-expansion protection.
- One language-neutral type model shared by all generators (formats, nullability, optional,
  unions, dictionaries, merged identical classes, unique valid names).
- Code-generation worker; ZIP export (JSZip, loaded on demand); Monaco syntax highlighting for C#,
  TypeScript, Java, Python, SQL, XML, YAML, Markdown and HTML.

### Changed

- Shared workspace: the JSON document store, drafts, input/output panels, document dialogs and the
  operation hook moved from JSON Studio to shared layers, so generators reuse them. JSON Studio and
  the generators work on the same document.
- `useTaskOperation` is generic over any task runner.
- Generated code is shown without word wrap.

### Security

- `fast-xml-parser` 5.12.0 (fixes GHSA-474x-hrwr-fgx4); XML DTD entity declarations are rejected.

## [0.2.0] - 2026-11-11

JSON Studio (roadmap Phase 4).

### Added

- JSON Studio with 16 tools: Formatter, Validator, Minifier, Beautifier, Tree Viewer, Compare,
  Path Finder, JSONPath Tester, Schema Generator, Schema Validator, Flatten, Unflatten, Search,
  Sort Keys, JSON → CSV and CSV → JSON.
- Strict RFC 8259 analyzer with precise, friendly error messages, duplicate-key detection and statistics.
- Self-hosted Monaco editor (CSP-safe, offline) with error markers, Go-to-error, live editor
  preferences and a large-file mode; Monaco diff editor.
- Web Worker task runner with a worker pool, cancellation, typed error transport and main-thread
  fallback; large inputs run on demand.
- Reusable components: `CodeEditor`, `DiffEditor`, `JsonViewer` (virtualized ARIA tree), `DataGrid`
  (virtualized, sortable), `SplitPane`, `ToolWorkspace`, `ToolSidebar`, `Panel`, `FileDropZone`,
  `UploadButton`, `DownloadButton`.
- Saved JSON documents (open, save, save as, delete, deep links), working drafts restored after
  reload, per-tool remembered options, and tool-history recording on copy/download.

### Changed

- JSON Schema validation uses `@cfworker/json-schema` (interpreting, CSP-safe) instead of the
  planned Ajv, which requires `unsafe-eval`.
- Heavy components are no longer exported from the `@/components` barrel, which keeps the initial
  bundle small.
- ESLint enforces that only the code-editor components import Monaco.

### Security

- Overrode Monaco's pinned DOMPurify 3.4.15 with the patched 3.4.17 (critical DOM-XSS advisories,
  GHSA-p98j-92pf-mc4p and related). `npm audit --omit=dev` now reports 0 vulnerabilities, and CI
  fails on any high or critical production advisory.

### Fixed

- A notification arriving while another was closing re-opened the old toast and delayed the new one.
- `SearchInput` with `debounceMs={0}` could revert newer input with a stale value.
- Breadcrumbs overlapped the top-bar actions on phones.
- MUI tooltips replaced the accessible name of buttons with visible labels (now `describeChild`).
- The e2e suite could silently test a stale build through a reused preview server.

## [0.1.0] - 2026-11-11

Foundation release: roadmap Phases 1–3 (architecture, scaffold, application shell and dashboard).

### Added

- React 19 + TypeScript 6 (strict) + Vite 8 project with feature-based architecture and
  ESLint-enforced layer boundaries (pure `core/`, `services/`, isolated `features/`).
- Tooling: ESLint 9 (typescript-eslint strict type-checked, React hooks and compiler rules,
  jsx-a11y), Prettier, Vitest 5, React Testing Library, Playwright, GitHub Actions CI.
- Material UI 9 theme with light, dark and system modes, design tokens, self-hosted Inter and
  JetBrains Mono, and reduced-motion support.
- Tool registry: 11 modules and 70 tools as the single source of truth for navigation, search,
  breadcrumbs, favorites and statistics.
- Application shell: collapsible persisted sidebar, mobile drawer, top bar with breadcrumbs,
  global search, recent tools, theme menu, shortcuts dialog and settings.
- Command palette (`Ctrl/⌘ K`) with fuzzy tool search, IndexedDB entity search, `>` action mode
  and full keyboard/ARIA support.
- Global shortcuts: `Ctrl/⌘ B`, `Ctrl/⌘ Shift L`, `?`, `Alt 0`, `Alt 1…9`.
- Dashboard: tool and workspace statistics, customizable quick access, recently used and
  favorite tools, a usage chart (ECharts), recent requests, documents and snippets, and inline
  tool search.
- Favorites page and Settings page (appearance, editor preferences, storage usage, persistent
  storage request, usage reset).
- Module overview pages and tool routes with lazy loading, alias redirects and honest
  "scheduled for Phase N" states for tools not yet implemented.
- IndexedDB schema v1 (Dexie) with all 10 required tables plus `toolUsage`; repositories;
  quota-aware writes.
- Validated localStorage preferences with prototype-pollution protection.
- Reusable components: ToolHeader, PageContainer, SectionCard, ToolCard, ToolIcon, EmptyState,
  LoadingState, ErrorBoundary, ConfirmationDialog, NotificationProvider, SearchInput, CopyButton,
  Kbd, EChart.
- Content Security Policy and security headers for `vite preview` and Vercel.
- Documentation: README, CLAUDE.md, ARCHITECTURE, DATABASE_SCHEMA, FEATURE_LIST, TESTING,
  DEPLOYMENT.
