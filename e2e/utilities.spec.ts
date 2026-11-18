import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { expect, test } from './fixtures';

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

/** Signs an RS256 JWT with Node's crypto so the browser verifies a token it did not create. */
function rs256Token(payload: object) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const input = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
  const signature = sign('sha256', Buffer.from(input), privateKey);
  return {
    token: `${input}.${b64url(signature)}`,
    pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

test.describe('Developer utilities', () => {
  test('JWT: decode, then verify an RS256 signature with Web Crypto', async ({ page }) => {
    const { token, pem } = rs256Token({
      sub: 'user-42',
      iss: 'https://auth.example',
      exp: 4102444800,
    });
    await page.goto('/utils/jwt-decoder');
    await page.getByRole('textbox', { name: 'JWT' }).fill(token);
    await expect(page.getByText('Signature not verified')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Claims' })).toContainText('"user-42"');

    await page.getByRole('button', { name: 'Verify signature' }).click();
    await expect(page).toHaveURL(/\/utils\/jwt-verify$/);
    await page.getByRole('tab', { name: 'PEM public key / certificate' }).click();
    await page.getByRole('textbox', { name: 'Public key or X.509 certificate (PEM)' }).fill(pem);
    await page
      .getByRole('textbox', { name: 'Expected issuer (optional)' })
      .fill('https://auth.example');
    await page.getByRole('button', { name: 'Verify signature' }).click();
    await expect(page.getByText('Signature verified')).toBeVisible();

    // A tampered payload must fail with the same key.
    const [h, , s] = token.split('.');
    const forged = `${h ?? ''}.${b64url(JSON.stringify({ sub: 'admin', iss: 'https://auth.example' }))}.${s ?? ''}`;
    await page.getByRole('textbox', { name: 'JWT' }).fill(forged);
    await expect(page.getByText('Signature verified')).toBeHidden();
    await page.getByRole('button', { name: 'Verify signature' }).click();
    await expect(page.getByText('Invalid signature')).toBeVisible();
  });

  test('hash: hashes a file locally in chunks', async ({ page }) => {
    const content = Buffer.alloc(5 * 1024 * 1024 + 123, 'devstudio-');
    const expected = createHash('sha256').update(content).digest('hex');
    await page.goto('/utils/hash');
    await page.getByRole('tab', { name: 'File' }).click();
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'data.bin', mimeType: 'application/octet-stream', buffer: content });
    await expect(page.getByRole('table', { name: 'Digests' })).toContainText(expected, {
      timeout: 15_000,
    });
  });

  test('password generator uses secure randomness and keeps nothing', async ({ page }) => {
    await page.goto('/utils/password');
    const list = page.getByRole('list', { name: 'Generated passwords' });
    await expect(list.getByRole('listitem').first()).toBeVisible();
    const first = await list.getByRole('listitem').first().textContent();
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(list.getByRole('listitem').first()).not.toHaveText(first ?? '');
    await page.reload();
    await expect(list.getByRole('listitem').first()).not.toHaveText(first ?? '');
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toContain((first ?? '').slice(0, 12));
  });

  test('timezone, cron and color pages work under the production CSP', async ({ page }) => {
    await page.goto('/utils/timezone');
    await expect(page.getByRole('table', { name: 'Converted times' })).toBeVisible();

    await page.goto('/utils/cron');
    await page.getByRole('textbox', { name: 'Cron expression' }).fill('0 0 1 1 *');
    await expect(page.getByLabel('Description')).toContainText('January');
    await expect(page.getByRole('list', { name: 'Next runs' }).getByRole('listitem')).toHaveCount(
      10,
    );

    await page.goto('/utils/color');
    await page
      .getByRole('textbox', { name: 'Color (HEX, rgb(), hsl() or name)', exact: true })
      .fill('hsl(120 100% 25%)');
    await expect(page.getByRole('table', { name: 'Color formats' })).toContainText('#008000');
    await expect(page.getByRole('table', { name: 'Color formats' })).toContainText('green');
  });
});
