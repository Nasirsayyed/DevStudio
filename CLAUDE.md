# CLAUDE.md: working on DevStudio

DevStudio is a backend-less React 19 + TypeScript SPA. Read `docs/ARCHITECTURE.md` before
making structural changes.

## Commands

```bash
npm run typecheck   # must pass
npm run lint        # must pass with zero warnings
npm test            # Vitest
npm run e2e         # Playwright (builds and serves dist/ with production CSP)
npm run check       # typecheck + lint + test
```

Run `npm run check` before every commit. Run `npm run e2e` when touching routing, layout,
security headers or anything user-visible across pages.

## Architecture rules (enforced by ESLint `no-restricted-imports`)

- `src/core/`: pure TypeScript. No React, MUI, Dexie, or app layers. Must be usable in Web Workers.
- `src/services/`: side effects (IndexedDB, localStorage, HTTP, workers). No UI imports.
- `src/features/<feature>/`: one folder per module. **Never import from another feature.**
  Shared logic belongs in `core/`, shared UI in `components/`, shared hooks in `hooks/`.
- `src/components/`: reusable presentational components. No direct storage access.
- `src/tools/`: the tool registry, the **single source of truth** for modules and tools. The
  sidebar, palette, dashboard, breadcrumbs and favorites all derive from it.
- `src/app/`: shell (providers, router, layout, command palette, global shortcuts).

## Adding a tool page (Phases 4+)

1. The tool should already exist in `src/tools/toolRegistry.ts`. Tool ids are persisted, so
   **never rename an id**; add an `aliasOf` entry instead.
2. Put pure logic in `src/core/<area>/` with unit tests (include malformed input and edge cases).
3. Create the page in `src/features/<feature>/pages/` (default export).
4. Register it in `src/tools/toolPages.ts`:
   `'json.formatter': () => import('@/features/json-studio/pages/JsonFormatterPage')`.
   Routing, breadcrumbs, favorites, usage tracking and code splitting then work automatically.
5. Add RTL tests for the page and update `docs/FEATURE_LIST.md` and `CHANGELOG.md`.

## Conventions

- Strict TypeScript, `noUncheckedIndexedAccess`. No `any`, no non-null assertions in app code.
- MUI v9 removed system props: put layout props in `sx` (`<Stack sx={{ alignItems: 'center' }}>`),
  and Typography styles in `slotProps={{ primary: { sx: {...} } }}`.
- Icons: import from `iconsax-reactjs`. Render registry icons with `<ToolIcon tool={...} />`.
  Never create components during render (the React Compiler lint enforces this).
- Every IndexedDB write goes through a repository using `safeWrite()` (quota → `StorageQuotaError`).
- Parse untrusted JSON with `safeJsonParse()` and validate it with Zod.
- Never use `eval`, `new Function`, or `dangerouslySetInnerHTML` with unsanitized content.
- The CSP lives in `config/security-headers.ts` and must match `vercel.json` (a test enforces this).
- Errors shown to users: throw or convert to `AppError` subclasses; display with `toUserMessage()`.
- Never ship placeholder controls that pretend to work. Unimplemented tools show `ScheduledNotice`.

## Testing notes

- Component tests render the real app with `renderApp(path)` from `src/test/renderApp.tsx`,
  and call `resetAppState()` in `beforeEach`.
- Repository tests use isolated databases from `createTestDatabase()` (fake-indexeddb).
- Query by role and accessible name (`getByRole('button', { name: ... })`), not by class or test id.
