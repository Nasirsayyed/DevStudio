# DevStudio

An all-in-one, browser-based developer productivity suite: API testing, JSON tooling, code
generators, SQL tooling, developer utilities, text tools and a snippet manager in one fast,
keyboard-friendly app.

**Everything runs in your browser.** There is no backend; your data lives in IndexedDB and
localStorage on your device. Network requests leave the browser only when you explicitly send
an API request.

## Status

| Area                                                                     | State                     |
| ------------------------------------------------------------------------ | ------------------------- |
| Foundation: project, tooling, CI, architecture                           | ✅ Done                   |
| App shell: sidebar, top bar, routing, themes, command palette, shortcuts | ✅ Done                   |
| Dashboard, Favorites, Settings                                           | ✅ Done                   |
| IndexedDB schema (all 11 tables), preferences, storage services          | ✅ Done                   |
| JSON Studio (16 tools, Monaco, Web Workers, saved documents)             | ✅ Done                   |
| Code Generators (C#, TypeScript, Java, Python, SQL, XML ⇄ JSON)          | ✅ Done                   |
| Developer Utilities (18 tools, JWT verification, hashing, time zones)    | ✅ Done                   |
| Text Tools, Snippets, SQL, API Studio, History/Backup                    | 🗓 Scheduled (Phases 7–11) |

Tools that are not implemented yet are listed (so you can search, favorite and pin them),
and their pages clearly say which phase delivers them. No placeholder UI pretends to work.
See [docs/FEATURE_LIST.md](docs/FEATURE_LIST.md) and
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Quick start

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script                            | Purpose                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server with HMR                                                        |
| `npm run build`                   | Typecheck + production build to `dist/`                                         |
| `npm run preview`                 | Serve `dist/` with production security headers (CSP)                            |
| `npm run typecheck`               | `tsc -b` across app, node configs and e2e                                       |
| `npm run lint`                    | ESLint (strict type-checked, React hooks/compiler, a11y), zero warnings allowed |
| `npm run format` / `format:check` | Prettier                                                                        |
| `npm test`                        | Vitest unit + component tests                                                   |
| `npm run test:coverage`           | Tests with V8 coverage                                                          |
| `npm run e2e`                     | Playwright end-to-end tests against the production build                        |
| `npm run check`                   | typecheck + lint + tests                                                        |

## Keyboard shortcuts

| Shortcut         | Action                                                 |
| ---------------- | ------------------------------------------------------ |
| `Ctrl/⌘ K`       | Command palette / global search (type `>` for actions) |
| `Ctrl/⌘ B`       | Collapse / expand sidebar                              |
| `Ctrl/⌘ Shift L` | Cycle theme (light → dark → system)                    |
| `Alt 1…9`        | Open quick-access tool 1–9                             |
| `Alt 0`          | Dashboard                                              |
| `Ctrl/⌘ Enter`   | Run the current tool (editors)                         |
| `?`              | Show all shortcuts                                     |

## Tech stack

React 19 · TypeScript 6 (strict) · Vite 8 · Material UI 9 · Iconsax (`iconsax-reactjs`) ·
Zustand 5 · Dexie 4 (IndexedDB) · React Router 8 · Zod 4 · Apache ECharts 6 · date-fns 4 ·
Vitest 5 · React Testing Library · Playwright.

Monaco Editor · `@cfworker/json-schema` · `jsonpath-plus` (safe evaluator) · PapaParse · FileSaver · JSZip · fast-xml-parser/-builder/-validator.

Utilities: `jose` (JWT verification, Web Crypto), `crypto-js` (MD5/SHA/Keccak/RIPEMD/HMAC),
`@date-fns/tz`, `cron-parser` + `cronstrue`, `entities`, `mime`, `ua-parser-js`.

Libraries for later modules (sql.js and others) are installed in the phase that uses them. Each
library is loaded only with the page that needs it, so the initial bundle stays small.

## Documentation

| Document                                                   | Contents                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)               | Layers, folder structure, module boundaries, routing, state |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)         | IndexedDB tables, indexes, migrations, localStorage keys    |
| [docs/FEATURE_LIST.md](docs/FEATURE_LIST.md)               | Every feature and its status                                |
| [docs/TESTING.md](docs/TESTING.md)                         | Test strategy, how to run, conventions                      |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                   | Vercel, security headers, CI                                |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Roadmap, risks and decisions                                |
| [CHANGELOG.md](CHANGELOG.md)                               | Release notes                                               |
| [CLAUDE.md](CLAUDE.md)                                     | Conventions for AI-assisted development                     |

## Privacy and security

- No backend and no analytics. Usage statistics stay in your browser.
- A strict Content Security Policy (`script-src 'self'`, no `unsafe-eval`) is enforced in
  production and in the end-to-end tests.
- All untrusted JSON (imports, stored preferences) is parsed with prototype-pollution
  protection and validated with Zod.
- Tokens, keys, secrets and generated passwords are never stored or written to history. Random
  values come from `crypto.getRandomValues`. The JWT decoder never claims a signature is valid;
  only the verifier (Web Crypto) does.
