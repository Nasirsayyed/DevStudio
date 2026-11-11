# Deployment

DevStudio builds to static files (`dist/`) and can be hosted on any static host. The reference
target is **Vercel**. Automated production deployment is completed in Phase 13; everything
below already works.

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
- `Cache-Control: public, max-age=31536000, immutable` for hashed `/assets/*`.

To deploy manually: import the repository in Vercel. No environment variables or secrets are
required, because the app has no backend and embeds no keys.

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

Phase 13 adds the Vercel deployment workflow (preview per PR, production on `main`).
