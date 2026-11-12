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
- Secrets (tokens, keys, HMAC keys, passwords, generated random values) are never persisted: no
  `usePersistentOptions`, IndexedDB or history entries. Use `core/random/secureRandom` for any
  random value; never `Math.random()`. Never call a JWT "verified" unless `verifyJwt` said so.

## Shared workspace

- JSON-based tools share `useJsonWorkspaceStore` (document, drafts) and the panels in
  `components/workspace/`. Don't create feature-local copies of them.
- Run operations with `useTaskOperation(key, (p, o) => runner.run(op, p, o), payload)`, wrapped per
  feature (see `useJsonOperation`, `useCodegenOperation`). Memoize `payload`; `null` means idle.
- New code generators map `core/codegen/model.ts` types; never re-infer types in an emitter.

## Heavy code and bundles

- Import `JsonViewer`, `DataGrid`, `FileDropZone`/`UploadButton`, `DownloadButton` and `EChart` **by
  path**, never through the `@/components` barrel (that would put them in the initial bundle).
- Heavy pure operations go into an operation table in `core/` (see `core/json/operations.ts`) and run
  through a task runner (`services/workers`). Never block the main thread on large input.
- Monaco: only `components/code-editor/*` may import `monaco-editor`. When upgrading Monaco,
  regenerate `monacoEditorCore.ts` from `editor.main.js` (see the header comment) and run the e2e suite.
- `package.json` `overrides` pins Monaco's DOMPurify to a patched version. Remove the override once
  a Monaco release depends on DOMPurify ≥ 3.4.17 (check with `npm ls dompurify`).
- Never use Ajv or other code-generating validators (CSP forbids `unsafe-eval`). JSONPath must use
  `eval: 'safe'`.

## Testing notes

- Component tests render the real app with `renderApp(path)` from `src/test/renderApp.tsx`,
  and call `resetAppState()` in `beforeEach`.
- Repository tests use isolated databases from `createTestDatabase()` (fake-indexeddb).
- Query by role and accessible name (`getByRole('button', { name: ... })`), not by class or test id.
- Monaco is replaced in jsdom by an accessible textarea double (`src/test/mocks/MockCodeEditor.tsx`,
  wired in `src/test/setup.ts`). Use `setEditorText(user, editor, text)` to paste content. Problems
  render as a list named "<editor label> problems".
- jsdom has no layout; the setup reports a 1024×768 box so virtualized lists render rows.
- MUI `Tooltip` replaces a child's accessible name unless `describeChild` is set. Use it when the
  button already has visible text.
