# Deployment

DevStudio builds to static files (`dist/`) and can be hosted on any static host. The reference
target is **Vercel**, deployed by GitHub Actions: a smoke-tested preview for every pull request and
production after CI passes on `main`.

## Build

```bash
npm ci
npm run build      # tsc -b + vite build → dist/
npm run preview    # serve dist/ locally with production security headers
```

## Vercel

`vercel.json` configures:

- Framework `vite`, build command `npm run build`, output `dist`.
- SPA rewrite: all non-asset paths go to `index.html`, so deep links like `/json/formatter` work.
- Security headers on every response:
  - `Content-Security-Policy`: see below
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups` (allows OAuth popups in Phase 10)
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `Cache-Control: public, max-age=31536000, immutable` for hashed `/assets/*`, and `no-cache` for
  everything else (`index.html` and SPA routes), so a new deployment is picked up on the next
  load while assets stay cached. `vite preview` applies the same rules (`vite.config.ts`).

The app needs no environment variables or secrets at build or run time: it has no backend and
embeds no keys. The secrets below are only for the deployment workflow.

## Content Security Policy

Defined once in `config/security-headers.ts`:

```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:;
connect-src 'self' https: http:; frame-src 'self' blob:; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

| Directive                              | Why                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `script-src 'self' 'wasm-unsafe-eval'` | No inline or remote scripts and no `eval`. WASM compilation is needed by sql.js (Phase 9)          |
| `style-src 'unsafe-inline'`            | Required by Emotion (MUI) and Monaco runtime styles                                                |
| `connect-src https: http:`             | API Studio sends **user-initiated** requests to arbitrary endpoints. Nothing is sent automatically |
| `frame-src blob:`                      | Sandboxed HTML preview (Phase 7)                                                                   |

`vercel.json` must mirror this file exactly. A unit test fails if they diverge. The Playwright
suite runs against `vite preview` with the same headers and fails on any CSP violation.

The dev server (`npm run dev`) does not send the CSP, because Vite's HMR uses inline scripts.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:

1. **quality**: `npm ci`, production dependency audit (fails on high/critical), typecheck, lint (zero warnings), Prettier check, tests with coverage,
   production build (uploaded as an artifact).
2. **e2e**: installs Chromium and runs Playwright against the production build (the report is
   uploaded on failure).

The e2e suite includes the smoke tests (`e2e/smoke`) against the local production preview.
`.github/dependabot.yml` opens weekly update pull requests for npm packages and GitHub Actions.

## Automated deployment (`.github/workflows/deploy.yml`)

| Trigger                                | Job        | What happens                                                                                       |
| -------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| Pull request from this repository      | preview    | `vercel build` + `vercel deploy --prebuilt`, smoke tests against the preview, URL posted on the PR |
| CI succeeded on a push to `main`       | production | Builds the exact commit CI tested, `vercel deploy --prebuilt --prod`, smoke tests                  |
| Manual (`workflow_dispatch` on `main`) | production | Same as above                                                                                      |

Pull requests from forks never receive secrets, so they get no preview (`pull_request_target` is
deliberately not used). Without the secrets, both jobs skip with a notice instead of failing.
The Vercel CLI is pinned (`VERCEL_CLI` in the workflow).

### One-time setup

1. Create the Vercel project: `npx vercel@65.9.0 link` in the repository (or import it in the
   Vercel dashboard). This writes `.vercel/project.json` (git-ignored) with `orgId` and
   `projectId`.
2. Create a token at vercel.com/account/tokens.
3. In GitHub → Settings → Secrets and variables → Actions, add the secrets `VERCEL_TOKEN`,
   `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. Optional: `VERCEL_AUTOMATION_BYPASS_SECRET` (if
   preview deployments are protected, so smoke tests can reach them) and the variable
   `PRODUCTION_URL` (your production domain; smoke tests then check it after each deploy).
4. Optional, recommended: create the GitHub environments `preview` and `production` (for example
   with required reviewers on production).
5. Decide whether Vercel's own Git integration should also deploy. If GitHub Actions should be the
   only path (nothing reaches production without passing CI), turn it off, either in the Vercel
   project settings (Git) or by adding `"git": { "deploymentEnabled": false }` to `vercel.json`.
   Otherwise both Vercel and the workflow deploy each commit.

## Smoke tests

`e2e/smoke/smoke.spec.ts` checks a running deployment: every security header and the cache rules,
hashed assets served as immutable JavaScript, SPA deep links (`/json/formatter`, `/oauth/callback`,
unknown routes) and that the app boots and runs SQLite (WebAssembly in a worker) under the CSP,
with the CSP-violation fixture active.

```bash
SMOKE_URL=https://your-deployment.example npm run smoke
```

## Other static hosts

Serve `dist/` with: an SPA fallback to `index.html` for every non-asset path, the headers from
`config/security-headers.ts` and the cache rules above. Then run the smoke tests against it.
