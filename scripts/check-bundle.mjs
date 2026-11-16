#!/usr/bin/env node
/**
 * Bundle budgets (gzip sizes) for the production build in dist/.
 *
 * - initial: every script and stylesheet index.html loads up front (entry + modulepreloads).
 * - chunk: any single lazily loaded JavaScript chunk (Monaco's editor core is the largest).
 *
 * Run after `npm run build`: `npm run bundle:check`. Fails (exit 1) when a budget is exceeded.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGETS = {
  initialGzip: 400 * 1024,
  chunkGzip: 750 * 1024,
};

const dist = new URL('../dist/', import.meta.url).pathname;
const gzip = (file) => gzipSync(readFileSync(join(dist, file))).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initial = [
  ...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])),
];
const initialSizes = initial.map((f) => [f, gzip(f)]).sort((a, b) => b[1] - a[1]);
const initialTotal = initialSizes.reduce((sum, [, size]) => sum + size, 0);

const initialSet = new Set(initial.map((f) => f.slice('assets/'.length)));
const lazy = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.js') && !initialSet.has(f))
  .map((f) => [f, gzip(join('assets', f))])
  .sort((a, b) => b[1] - a[1]);

const problems = [];
console.log(`Initial load: ${kb(initialTotal)} gzip (budget ${kb(BUDGETS.initialGzip)})`);
for (const [f, size] of initialSizes) console.log(`  ${kb(size).padStart(10)}  ${f}`);
if (initialTotal > BUDGETS.initialGzip) problems.push(`initial load is ${kb(initialTotal)}`);

console.log(`\nLargest lazy chunks (budget ${kb(BUDGETS.chunkGzip)} each):`);
for (const [f, size] of lazy.slice(0, 8)) console.log(`  ${kb(size).padStart(10)}  ${f}`);
for (const [f, size] of lazy) if (size > BUDGETS.chunkGzip) problems.push(`${f} is ${kb(size)}`);

if (problems.length > 0) {
  console.error(`\nBundle budget exceeded:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll bundle budgets met.');
