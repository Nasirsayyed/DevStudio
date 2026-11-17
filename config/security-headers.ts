/**
 * Single source of truth for the production Content Security Policy and
 * security headers. Used by `vite preview` (so e2e tests run under the real
 * policy) and mirrored in vercel.json (verified by a unit test).
 *
 * Notes:
 * - 'unsafe-inline' for styles is required by Emotion (MUI) and Monaco.
 * - 'wasm-unsafe-eval' (NOT 'unsafe-eval') is required for sql.js (Phase 9).
 * - connect-src allows any https/http origin because API Studio sends
 *   user-invoked requests to arbitrary endpoints. Nothing is sent automatically.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https: http:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'X-Frame-Options': 'DENY',
  // Browsers ignore HSTS over plain http (local preview), so it is safe to send everywhere.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

/** Hashed build assets never change; everything else (index.html, SPA routes) must revalidate. */
export const CACHE_HEADERS = {
  assets: 'public, max-age=31536000, immutable',
  html: 'no-cache',
} as const;
