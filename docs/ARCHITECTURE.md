# Architecture

DevStudio is a static single-page application. All logic runs in the browser; persistence is
IndexedDB (Dexie) plus a small validated localStorage preferences record.

## Layers

```
src/
├── app/            Shell: providers, router, layout, command palette, global shortcuts
├── features/       One folder per module (dashboard, favorites, settings, module-overview, ...)
├── components/     Reusable presentational UI
├── hooks/          Reusable React hooks (may use services)
├── stores/         Zustand stores (preferences: persisted; ui: ephemeral)
├── tools/          Tool registry: modules, tools, lazy page map, tool search
├── services/       Side effects: db (Dexie + repositories), preferences, storage
├── core/           Pure, framework-free logic (search, hotkeys, errors, security, formatting)
├── theme/          Design tokens + MUI theme factory
├── types/          Shared domain types (entities, tools)
└── test/           Test setup and helpers
config/             Security headers (CSP), shared by vite preview, vercel.json and tests
e2e/                Playwright specs
```

### Dependency rules

| Layer        | May import                             | Must not import                                                          |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------ |
| `core`       | other `core`                           | React, MUI, Dexie, `services`, `features`, `components`, `app`, `stores` |
| `services`   | `core`, `types`, Dexie, Zod            | `features`, `components`, `app`, MUI                                     |
| `components` | `core`, `hooks`, `tools`, `theme`, MUI | storage directly                                                         |
| `features/X` | everything above                       | `features/Y` (any other feature)                                         |
| `app`        | everything                             | (none)                                                                   |

These rules are enforced with ESLint `no-restricted-imports` (see `eslint.config.js`). As a
result, shared logic cannot be duplicated across features. For example, tool search exists once
(`tools/toolSearch.ts`) and is used by the palette, dashboard, favorites, quick access and
module pages.

## Tool registry (single source of truth)

- `tools/modules.ts`: the 11 sidebar modules (title, path, icon, phase, section).
- `tools/toolRegistry.ts`: 70 canonical tools + aliases, with id `"<module>.<slug>"`,
  keywords, description, group and roadmap phase.
- `tools/toolPages.ts`: lazy page loaders for implemented tools. A tool without a loader
  renders its honest "Scheduled for Phase N" state.
- `tools/ToolPageRenderer.tsx`: creates one `React.lazy` component per tool at module level,
  so each tool page is its own chunk.
- `tools/toolSearch.ts`: the only tool-search implementation. Ranks title > keywords > module and
  description, boosts tools of a module named in the query, and slightly boosts recently used tools.

Everything navigational (sidebar, breadcrumbs, palette, dashboard, quick access, favorites,
usage statistics) is derived from the registry. Adding a tool means adding one registry entry.

## Routing

`app/router/routes.tsx` (React Router 8 data router):

| Path                                                   | Page                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `/`                                                    | Dashboard                                                                                            |
| `/api`, `/json`, `/codegen`, `/sql`, `/utils`, `/text` | Module overview (searchable, grouped tool grid)                                                      |
| `/<module>/:toolSlug`                                  | `ToolRoutePage`: registry lookup → alias redirect → lazy tool page or scheduled state; records usage |
| `/snippets`, `/history`                                | Scheduled module pages (Phases 8 and 11)                                                             |
| `/favorites`, `/settings`                              | Implemented                                                                                          |
| `*`                                                    | 404 with search                                                                                      |

Every page is a separate chunk (`app/router/lazyPages.ts`). The command palette and the ECharts
usage chart are also lazy, so ECharts (about 200 KB gzip) loads only when the dashboard has usage
data to chart.

## State

| State                                                                      | Where                        | Persistence                                                     |
| -------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| Theme, sidebar collapsed, editor prefs, selected environment, recent tools | `stores/preferencesStore.ts` | localStorage `devstudio:prefs:v1`, validated with Zod per field |
| Palette open, shortcuts dialog, mobile drawer                              | `stores/uiStore.ts`          | none                                                            |
| Saved work, favorites, usage, settings                                     | IndexedDB via repositories   | Dexie; UI reads through `useLiveQuery`, so views update live    |

## Shell

- **Sidebar**: on `md` and up, a permanent drawer that collapses to a 68 px icon rail with
  tooltips; the state is persisted. Below `md`, a temporary drawer opened from the top bar.
- **Top bar**: breadcrumbs (derived from the registry), a global search button (opens the palette),
  recent tools menu, theme menu (light/dark/system), shortcuts dialog and settings.
- **Command palette** (`Ctrl/⌘ K`): searches tools (in memory) and saved requests, JSON documents,
  SQL scripts, snippets and history (debounced IndexedDB prefix plus bounded substring queries).
  A `>` prefix shows actions only. It implements the ARIA combobox/listbox pattern with
  `aria-activedescendant` and ↑/↓/Home/End/Enter/Esc.
- **Global shortcuts** (`app/GlobalShortcuts.tsx`, `hooks/useHotkey.ts`, `core/keyboard/hotkeys.ts`):
  platform-aware (⌘ on Apple, Ctrl elsewhere). Single-key shortcuts never fire while typing.
  `Alt+digit` uses the physical key code, so it works on every keyboard layout.
- **Error handling**: `ErrorBoundary` around the outlet, reset on navigation; a route
  `errorElement` as a last resort; `AppError` hierarchy plus `toUserMessage()`; a toast queue
  via `useNotify()`; and a promise-based `useConfirm()`.

## Reusable components

Lightweight components are exported from the `@/components` barrel. Heavier ones are **imported by
path**, so that the app shell's barrel import never pulls them into the initial bundle (verified with
the build's source maps).

| Component                                                                                                                           | Import                                 | Notes                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ToolHeader`, `PageContainer`, `SectionCard`, `ToolCard`, `ToolIcon`, `Panel`, `EmptyState`, `LoadingState`, `ErrorBoundary`, `Kbd` | barrel                                 | Layout and states                                                                                  |
| `NotificationProvider` / `useNotify`, `ConfirmationDialog` / `useConfirm`                                                           | barrel                                 | Toast queue (a closing toast is never re-opened); promise-based confirm                            |
| `SearchInput`, `CopyButton`                                                                                                         | barrel                                 | Debounced search (no stale-value reverts); clipboard with feedback                                 |
| `SplitPane`                                                                                                                         | barrel                                 | Resizable panes (pointer, ←/→, Home/End, double-click reset), persisted ratio, stacked on phones   |
| `ToolWorkspace`, `ToolSidebar`                                                                                                      | barrel                                 | Full-height tool layout: module tool list (lg+), tool switcher (smaller), favorite toggle, toolbar |
| `CodeEditor`, `DiffEditor`                                                                                                          | barrel (lazy wrappers)                 | Monaco loads on first render (see below)                                                           |
| `JsonViewer`                                                                                                                        | `@/components/data-display/JsonViewer` | Virtualized ARIA tree, keyboard navigation, expand all / by level, highlight, reveal path          |
| `DataGrid`                                                                                                                          | `@/components/data-display/DataGrid`   | Virtualized, sortable ARIA grid                                                                    |
| `FileDropZone`, `UploadButton`                                                                                                      | `@/components/inputs/FileDropZone`     | Validated text files (type, size, binary detection, BOM strip)                                     |
| `DownloadButton`                                                                                                                    | `@/components/inputs/DownloadButton`   | FileSaver download                                                                                 |
| `EChart`                                                                                                                            | `@/components/charts/EChart`           | Tree-shaken ECharts, SVG renderer                                                                  |

## Code editor (Monaco)

- Monaco is **self-hosted** (`@monaco-editor/react` with `loader.config({ monaco })`), with no CDN
  loader. That keeps the strict CSP intact and makes the editor work offline.
- `components/code-editor/monacoEditorCore.ts` imports every editor contribution and its services
  exactly as `editor.main` does, but **without its ~80 languages and the LSP client**. Importing only
  `editor.api` leaves some contributions without their services (runtime "UNKNOWN service" errors).
  Regenerate this list when upgrading Monaco.
- Workers (`editor.worker`, `json.worker`) are bundled with Vite's `?worker` imports.
- Monaco's own JSON diagnostics are disabled. DevStudio's analyzer (`core/json/parse.ts`) is the
  single source of error markers, so messages and positions match the status bar and error panels.
- Editor preferences from Settings (font size, tab size, word wrap, minimap) apply live. The theme
  follows the app theme. Above 2 M characters a lighter "large file" configuration is used (no
  folding, wrap, minimap, sticky scroll or bracket colorization).
- `Ctrl/⌘+Enter` runs the current tool.
- Size: about 970 KB gzip, loaded only when an editor is first shown.

## Theming

`theme/tokens.ts` defines the light and dark color tokens, chart palette, radii and layout sizes.
`theme/createAppTheme.ts` builds the MUI theme and exposes the tokens as `theme.tokens` for
non-MUI consumers (charts now, Monaco later). Inter and JetBrains Mono are self-hosted with
`@fontsource-variable`, so there are no font CDNs, the app works offline, and the CSP stays strict.
Motion is disabled under `prefers-reduced-motion`.

## Performance

- Route-level and tool-level code splitting; vendor chunks for React, MUI, Dexie, icons and ECharts.
- ECharts is tree-shaken (`echarts/core` with only bar/line/pie/graph) and loaded lazily.
- IndexedDB queries use indexes (`orderBy('count')`, `orderBy('updatedAt')`, compound and
  multi-entry indexes) rather than scanning whole tables in JS.
- Search inputs are debounced; palette queries are tagged so stale results are never shown.
- Heavy components are imported by path, not through the barrel (see Reusable components).
- Monaco (about 970 KB gzip) and the JSON language worker load only when an editor is shown.
- Known cost: `iconsax-reactjs` ships every variant per icon (about 31 KB gzip for the ~60 icons
  used). Icons are imported per name, so tree-shaking works. Replacing the package is a one-file
  change if needed.

## Web Workers and heavy processing

```
features (useJsonOperation) ──► services/workers/jsonTasks ──► createTaskRunner
                                                                 │
                         size < 100 KB ──► main thread (after one yield)
                         size ≥ 100 KB ──► worker pool (max 2) ──► workers/json.worker.ts
                                                                 │      └─ core/tasks/protocol.handleTaskRequest
                                                                 └─ AbortSignal → terminates only that worker
```

- **One operation table** (`core/json/operations.ts`) runs on both the main thread and in workers,
  so there is no duplicated logic. Inputs are raw text, so parsing (the expensive part) also happens
  off the main thread.
- **Typed errors cross the boundary**: `serializeError`/`deserializeError` rebuild `ParseError`
  (with line, column and `source`, e.g. "left" or "schema") and `ValidationError`.
- **Cancellation**: every new run aborts the previous one; an aborted worker is terminated and
  replaced. Results of stale runs are never shown.
- **Resilience**: if a worker can't start (old browser or blocked by policy), the task falls back to
  the main thread, and later tasks skip the worker path.
- **Auto vs. manual**: inputs up to 1 MB re-run automatically (debounced 250 ms). Larger inputs run
  on demand (Run button or `Ctrl/⌘+Enter`) so typing never triggers repeated multi-MB processing.

## JSON Studio feature structure

```
features/json-studio/
├── store.ts                 shared working document (input, secondary, csv, open document) + draft persistence
├── hooks/                   useJsonOperation, useDocumentFromUrl (?document=id), useHistoryRecorder
├── components/              TransformLayout (input → output), JsonToolLayout (input → custom view),
│                            DualInputLayout (two inputs + results), JsonInputPanel, OutputPanel,
│                            DocumentDialogs (open/save), StatusViews, OptionControls
└── pages/                   16 tool pages, each a lazy chunk registered in tools/toolPages.ts
```

- The working document is **shared across all 16 tools**, so switching tools keeps your data. It is
  saved as a draft in IndexedDB (debounced; drafts above 5 M characters are skipped) and restored
  after a reload. Edits made while the draft is still loading are saved once it has loaded.
- Tool options are remembered per tool (`hooks/usePersistentOptions`, validated localStorage).
- Copying or downloading a result records a `toolHistory` entry (input/output truncated to 256 KB).
