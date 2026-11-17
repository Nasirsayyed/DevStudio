# Security

DevStudio is a static single-page app with no backend. Everything a user enters stays in their
browser (IndexedDB and localStorage) unless they explicitly send an API request. This document is
the result of the Phase 12 security review: the threats considered, the controls in place and how
each control is enforced.

## Threat model

| Threat                                          | Where it could come from                                 |
| ----------------------------------------------- | -------------------------------------------------------- |
| Script injection (XSS) through rendered content | Markdown/HTML previews, API responses, imported files    |
| Dynamic code execution                          | Libraries that compile code (validators, JSONPath)       |
| Prototype pollution                             | Imported JSON (backups, collections, snippets, settings) |
| Malicious or oversized files                    | Uploads, backups, collections                            |
| Leaking secrets (tokens, keys, passwords)       | Storage, history, backups, exports, drafts, logs         |
| Catastrophic regular expressions (ReDoS)        | User-supplied patterns                                   |
| Tab-napping / opener abuse                      | Links in previews, the OAuth sign-in pop-up              |
| Cross-origin data access                        | API Studio requests                                      |
| Unsafe imported "code" (Postman scripts)        | Collection files                                         |

## Controls

### Content Security Policy and headers

`config/security-headers.ts` is the single source of truth, used by `vite preview` (so every e2e
test runs under it) and mirrored in `vercel.json` (a unit test keeps them identical).

- `script-src 'self' 'wasm-unsafe-eval'`: no inline scripts and no `eval` (`'wasm-unsafe-eval'`
  only allows compiling the self-hosted SQLite WebAssembly).
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `connect-src 'self' https: http:` because API Studio sends user-initiated requests anywhere.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (camera, microphone, geolocation, payment off), `X-Frame-Options: DENY`,
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` (OAuth pop-up),
  `Strict-Transport-Security: max-age=63072000; includeSubDomains`.
- The Playwright fixture fails any test that logs a CSP violation or an uncaught page error.

### No dynamic code, no raw HTML

Enforced by ESLint for all application code:

- `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`.
- `dangerouslySetInnerHTML`, assignments to `innerHTML`/`outerHTML`, `insertAdjacentHTML` and
  `document.write` are errors.
- Ajv and other code-generating validators are banned imports; JSON Schema validation uses
  `@cfworker/json-schema`, JSONPath runs with `eval: 'safe'`.

User HTML (Markdown preview, HTML preview, HTML API responses) is sanitized with DOMPurify
(`services/html/sanitize`) and rendered only in `components/preview/PreviewFrame` with
`sandbox="allow-popups allow-popups-to-escape-sandbox"`: scripts and same-origin access are never
allowed (tested). External resources (images, CSS `url()`, `@import`) are blocked; links open in a
new tab with `rel="noopener noreferrer"`.

### Untrusted JSON and files

- All untrusted JSON goes through `safeJsonParse()` (drops `__proto__`, `constructor`,
  `prototype` keys) and is validated with Zod: backups (per-table row schemas), collections
  (DevStudio and Postman), snippet imports, preferences, drafts.
- Every file picker validates type and size before reading (`core/files/fileValidation`):
  JSON 50 MB, collections 20 MB, backups 500 MB, request body files 200 MB.
- Imported Postman scripts are never executed; the import reports how many were ignored.
- Invalid rows in backups are skipped and reported; a restore runs in one transaction.

### Secrets

- Random values use `crypto.getRandomValues` (`core/random/secureRandom`); `Math.random` is a lint
  error.
- Tool inputs that are secrets (JWT keys, HMAC keys, passwords, generated values) are never
  written to storage or history.
- API Studio: secret environment values stay in memory (`secretVault`) unless the user consents
  to storing them unencrypted; literal credentials are saved with a request only after explicit
  consent; drafts, history, collection exports and runner reports never contain credentials
  (credential headers, sensitive query parameters, URL user info and secret values are redacted).
  OAuth tokens are memory-only.
- Backups exclude saved credentials and stored secrets unless "Include saved credentials and stored
  secret values" is ticked, which shows a warning.

### Regular expressions

User patterns (find & replace, search) run in a Web Worker with a timeout; the worker is
terminated on timeout so the page stays responsive (tested end to end).

### Network (API Studio)

Requests go directly from the browser with `fetch`. CORS is never bypassed and there is no proxy:
blocked requests are explained (CORS, mixed content, timeouts, unreachable hosts). Cookies are only
sent when the user enables "Send cookies"; the referrer is never sent. Responses are capped at
50 MB.

### Pop-ups and OAuth

The authorization-code flow uses PKCE (S256) and a random `state`. The sign-in pop-up starts as
`about:blank`, drops `window.opener`, then navigates to the provider, so the provider page cannot
navigate DevStudio (no reverse tab-napping) while blocked pop-ups are still detected. The
`/oauth/callback` page relays the redirect over a same-origin `BroadcastChannel`; the opener only
accepts it when `state` matches (a forged `state` is ignored, tested). `window.open` anywhere else
is a lint error.

### Deployment

The deploy workflow never runs for fork pull requests with secrets (no `pull_request_target`),
pins the Vercel CLI, deploys exactly the commit CI tested, and smoke-tests every deployment's
headers and CSP. Secrets live only in GitHub repository secrets.

### Dependencies

`npm audit --omit=dev --audit-level=high` runs in CI, and Dependabot proposes updates weekly. Monaco's bundled DOMPurify is pinned to a
patched version through `package.json` `overrides`.

## Accessibility and performance gates (Phase 12)

- `e2e/a11y.spec.ts` runs axe (WCAG 2.1 A/AA) on 24 pages in light and dark themes and on pages
  with data and open overlays; any violation fails the build.
- `npm run bundle:check` enforces gzip budgets after `npm run build` (initial load 400 KB, any lazy
  chunk 750 KB) and runs in CI.

## Reporting a vulnerability

Please open a private security advisory on the repository rather than a public issue.
