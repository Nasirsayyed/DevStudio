import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'config/**/*.test.ts'],
      css: false,
      restoreMocks: true,
      // Integration tests render the whole app (lazy chunks compile on first use); coverage
      // instrumentation (CI runs test:coverage) makes the longest ones take over 10 s.
      testTimeout: 30_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
        // Regression floor (Phase 12 baseline: 86.8 / 79.9 / 81.2 / 88.0). Raise, never lower.
        thresholds: { statements: 85, branches: 78, functions: 80, lines: 86 },
      },
    },
  }),
);
