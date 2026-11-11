import { test as base, expect } from '@playwright/test';

/**
 * Extends the base test so that any Content-Security-Policy violation or
 * uncaught page error fails the test.
 */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text()))
          violations.push(msg.text());
      });
      page.on('pageerror', (error) => violations.push(`pageerror: ${error.message}`));
      await use(violations);
      expect(violations, 'CSP violations / page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
