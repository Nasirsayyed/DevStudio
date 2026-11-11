# Testing

| Layer                               | Tool                                        | Location                               | Command                 |
| ----------------------------------- | ------------------------------------------- | -------------------------------------- | ----------------------- |
| Unit (pure logic, services, stores) | Vitest                                      | `src/**/*.test.ts`, `config/*.test.ts` | `npm test`              |
| Component and integration           | Vitest + React Testing Library + user-event | `src/**/*.test.tsx`                    | `npm test`              |
| IndexedDB                           | Vitest + `fake-indexeddb`                   | `src/services/db/**/*.test.ts`         | `npm test`              |
| End-to-end                          | Playwright (Chromium)                       | `e2e/*.spec.ts`                        | `npm run e2e`           |
| Coverage                            | V8                                          | n/a                                    | `npm run test:coverage` |

## Current results

- **115 unit/component tests** in 18 files, all passing.
- **7 Playwright tests**, all passing against the production build under the production CSP.
- Coverage: about 87% statements overall; `core/` and `services/db` are at or near 100% statements.

## What is covered

| Area               | Highlights                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuzzy search       | ranking order, case, regex metacharacters, stability, context and recency boosts                                                                                                        |
| Hotkeys            | ⌘ vs Ctrl, exact modifiers, shifted symbols, `Alt+digit` on any layout (`¡` on macOS), editable targets                                                                                 |
| Security           | prototype-pollution stripping at any depth, malformed JSON, CSP has no `unsafe-eval`, `vercel.json` mirrors the CSP config                                                              |
| Preferences        | defaults, round trip, per-field fallback, corrupted JSON, pollution payloads, dedupe/cap, quota failure                                                                                 |
| Theme persistence  | store → localStorage, cycling, reload (e2e), dark background actually applied (e2e)                                                                                                     |
| IndexedDB          | all tables and indexes exist, data survives reconnect, unique favorites index, atomic concurrent increments, search prefix/substring/limits, recent ordering                            |
| Quota handling     | native and Dexie-wrapped quota errors → `StorageQuotaError`                                                                                                                             |
| Registry integrity | unique ids/paths, id = module.slug, aliases resolve to canonical tools, all spec tools present                                                                                          |
| Shell              | sidebar links and `aria-current`, collapse persistence, breadcrumbs, theme menu, 404s, alias redirect                                                                                   |
| Palette            | Ctrl+K and Escape, top-bar button, keyboard navigation with wrap-around, `aria-activedescendant`, `>` actions, IndexedDB entity results, empty state                                    |
| Shortcuts          | `?` dialog, `Ctrl+B`, `Alt+1` quick access                                                                                                                                              |
| Dashboard          | stats from IndexedDB, empty states, recent tools, inline search, quick-access customization persisted                                                                                   |
| Settings           | theme/editor prefs, reset with confirm, cancel keeps data                                                                                                                               |
| Components         | ErrorBoundary reset, confirmation (content stays during exit), toast queue, SearchInput debounce, no stale revert, Esc/clear, CopyButton success/failure                                |
| E2E                | module navigation, SPA deep links, persistence across reloads, palette, IndexedDB favorites, mobile drawer, no horizontal scroll, **zero CSP violations or page errors** (auto fixture) |

## Conventions

- Query by role and accessible name. This also checks accessibility.
- Component tests render the **real app** (`renderApp(path)`) with a memory router and the real
  IndexedDB layer (fake-indexeddb). Call `resetAppState()` in `beforeEach`.
- Repository tests use `createTestDatabase()` for an isolated database per test.
- Always include malformed and edge-case inputs for `core/` functions.
- Bugs found by tests get a dedicated regression test (for example the `SearchInput` stale-debounce
  revert and the confirmation dialog going blank during its exit transition).

## Environment notes

- jsdom 31 declares `window.matchMedia` but leaves it unimplemented. `src/test/setup.ts` stubs it as
  desktop width and light scheme.
- The e2e `webServer` builds and serves `dist/` through `vite preview`, which sends the production
  security headers from `config/security-headers.ts`.
- In CI, Playwright installs Chromium (`npx playwright install --with-deps chromium`). Locally, a
  pre-installed browser is used through `PLAYWRIGHT_BROWSERS_PATH` when set.
- Trace recording is off by default (`trace: 'off'`). Use `npx playwright test --trace on` to debug.
