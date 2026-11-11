# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
