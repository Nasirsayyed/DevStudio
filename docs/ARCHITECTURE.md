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

## Reusable components (current)

`ToolHeader`, `PageContainer`, `SectionCard`, `ToolCard`, `ToolIcon`, `EmptyState`, `LoadingState`,
`ErrorBoundary`, `ConfirmationDialog` / `useConfirm`, `NotificationProvider` / `useNotify`,
`SearchInput` (debounced, Esc to clear), `CopyButton`, `Kbd`, `EChart` (tree-shaken, SVG renderer,
theme-aware).

Planned with the modules that first need them: `CodeEditor` / `DiffEditor` (Monaco, Phase 4),
`JsonViewer` (virtualized, Phase 4), `SplitPane`, `DownloadButton`, `FileDropZone` (Phase 4),
`DataGrid` (Phase 4/9), `KeyValueEditor` (Phase 10), `ToolSidebar` (Phase 4).

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
- Known cost: `iconsax-reactjs` ships every variant per icon (about 31 KB gzip for the ~60 icons
  used). Icons are imported per name, so tree-shaking works. Replacing the package is a one-file
  change if needed.

## Web Workers

There is no heavy processing in this phase. The worker pool (typed RPC with cancellation) arrives
in Phase 4 together with large-JSON processing. `core/` is already kept worker-safe for that reason.
