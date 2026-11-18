// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CACHE_HEADERS, CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from './security-headers';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

describe('security headers', () => {
  const vercel = JSON.parse(
    readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
  ) as VercelConfig;
  const global = vercel.headers.find((h) => h.source === '/(.*)');

  it('vercel.json mirrors config/security-headers.ts exactly', () => {
    expect(global).toBeDefined();
    const fromVercel = Object.fromEntries(global?.headers.map((h) => [h.key, h.value]) ?? []);
    expect(fromVercel).toEqual(SECURITY_HEADERS);
  });

  it('caches hashed assets forever and makes HTML revalidate', () => {
    const cache = (source: string) =>
      vercel.headers
        .find((h) => h.source === source)
        ?.headers.find((h) => h.key === 'Cache-Control')?.value;
    expect(cache('/assets/(.*)')).toBe(CACHE_HEADERS.assets);
    expect(cache('/((?!assets/).*)')).toBe(CACHE_HEADERS.html);
  });

  it('never allows unsafe-eval or remote scripts', () => {
    const scriptSrc = CONTENT_SECURITY_POLICY.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self' 'wasm-unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/'unsafe-eval'/);
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });
});
