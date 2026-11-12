import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/db/database';
import { renderApp, resetAppState } from '@/test/renderApp';
import { useUtilitiesStore } from '../store';

/** Text of the value cell in a ResultTable row. */
function rowValue(table: string, label: string): string {
  const t = screen.getByRole('table', { name: table });
  const header = within(t).getByRole('rowheader', { name: label });
  const row = header.closest('tr');
  return row?.querySelectorAll('td')[0]?.textContent ?? '';
}

const field = (name: string | RegExp) => screen.findByRole('textbox', { name });

beforeEach(async () => {
  await resetAppState();
  useUtilitiesStore.setState({ jwt: '' });
});

// jwt.io's canonical example, signed with HS256 and the secret "your-256-bit-secret".
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('Encoding utilities', () => {
  it('Base64 encodes UTF-8, decodes, and reports malformed input', async () => {
    const { user } = renderApp('/utils/base64');
    await user.type(await field('Text to encode (UTF-8)'), 'héllo ✓');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Base64' })).toHaveValue('aMOpbGxvIOKckw==');
    });
    await user.click(screen.getByRole('switch', { name: 'URL-safe (- _ no padding)' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Base64' })).toHaveValue('aMOpbGxvIOKckw');
    });

    await user.click(screen.getByRole('button', { name: 'Decode' }));
    const input = await field('Base64 to decode (standard or URL-safe)');
    await user.clear(input);
    await user.type(input, 'aMOpbGxvIOKckw');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Decoded text' })).toHaveValue('héllo ✓');
    });
    await user.clear(input);
    await user.type(input, 'abc$');
    expect(await screen.findByRole('alert')).toHaveTextContent(/\$/);
  });

  it('Base64 shows a hex dump and download for binary data', async () => {
    const { user } = renderApp('/utils/base64');
    await user.click(await screen.findByRole('button', { name: 'Decode' }));
    // PNG signature
    await user.type(await field(/Base64 to decode/), 'iVBORw0KGgo=');
    expect(await screen.findByText(/looks like image\/png/)).toBeInTheDocument();
    expect(screen.getByLabelText('Hex dump')).toHaveTextContent('89 50 4e 47');
    expect(screen.getByRole('button', { name: 'Download file' })).toBeInTheDocument();
  });

  it('URL encoder handles components, form mode and URL parsing', async () => {
    const { user } = renderApp('/utils/url-encoding');
    const urlField = await field('URL to parse');
    await user.clear(urlField);
    await user.type(urlField, 'https://ex.com:8080/a%20b?q=a%26b&x=1#top');
    await waitFor(() => {
      expect(rowValue('URL components', 'Port')).toBe('8080');
    });
    expect(rowValue('URL components', 'Fragment')).toBe('#top');
    const params = screen.getByRole('table', { name: 'Query parameters' });
    expect(within(params).getByText('a&b')).toBeInTheDocument();

    const text = screen.getByRole('textbox', { name: /Text to encode/ });
    await user.type(text, 'a b&c/d');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Encoded' })).toHaveValue('a%20b%26c%2Fd');
    });
  });

  it('HTML entities encode and decode', async () => {
    const { user } = renderApp('/utils/html-entities');
    await user.type(await field('Text or HTML to escape'), '<a href="x">Tom & Jerry</a>');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Escaped' })).toHaveValue(
        '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;',
      );
    });
    await user.click(screen.getByRole('button', { name: 'Decode' }));
    const input = await field(/^Text with entities/);
    await user.clear(input);
    await user.type(input, '&copy; &#x41; &eacute;');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Decoded' })).toHaveValue('© A é');
    });
  });
});

describe('JWT', () => {
  it('decodes without claiming verification, and links to the verifier', async () => {
    const { user, router } = renderApp('/utils/jwt-decoder');
    await user.click(await field('JWT'));
    await user.paste(`Bearer ${JWT}`);
    expect(await screen.findByText('Signature not verified')).toBeInTheDocument();
    const claims = screen.getByRole('table', { name: 'Claims' });
    expect(within(claims).getByText('"John Doe"')).toBeInTheDocument();
    expect(within(claims).getByText(/Issued at/i)).toBeInTheDocument();
    expect(screen.queryByText('Signature verified')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /verify/i }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/utils/jwt-verify');
    });
    // the token is carried over in memory
    expect(
      await screen.findByRole('heading', { level: 1, name: 'JWT Signature Verifier' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'JWT' })).toHaveValue(`Bearer ${JWT}`);
  });

  it('rejects malformed tokens with a precise message', async () => {
    const { user } = renderApp('/utils/jwt-decoder');
    await user.click(await field('JWT'));
    await user.paste('abc.def');
    expect(await screen.findByRole('alert')).toHaveTextContent(/3 parts|three/i);
  });

  it('verifies an HS256 signature and detects a wrong secret', async () => {
    const { user } = renderApp('/utils/jwt-verify');
    await user.click(await field('JWT'));
    await user.paste(JWT);
    const secret = screen.getByLabelText('Secret');
    await user.click(secret);
    await user.paste('your-256-bit-secret');
    const button = screen.getByRole('button', { name: 'Verify signature' });
    await user.click(button);
    expect(
      await screen.findByText('Signature verified', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    await user.type(secret, 'x');
    // editing the key hides the previous result until verified again
    expect(screen.queryByText('Signature verified')).not.toBeInTheDocument();
    await user.click(button);
    expect(await screen.findByText('Invalid signature', {}, { timeout: 5000 })).toBeInTheDocument();
    // secrets are never written to history
    expect(await db.toolHistory.count()).toBe(0);
  });
});

describe('Generators', () => {
  it('generates UUID v4 and inspects a v7 UUID', async () => {
    const { user } = renderApp('/utils/uuid');
    const list = await screen.findByRole('textbox', { name: 'UUIDs' });
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    await waitFor(() => {
      expect((list as HTMLTextAreaElement).value.split('\n').every((l) => v4.test(l))).toBe(true);
    });
    await user.type(
      screen.getByRole('textbox', { name: 'UUID to inspect' }),
      '01890a5d-ac96-774b-bcce-b302099a8057',
    );
    await waitFor(() => {
      expect(rowValue('UUID details', 'Version')).toMatch(/7/);
    });
    expect(rowValue('UUID details', 'Embedded time')).toMatch(/2023/);
  });

  it('formats GUIDs for .NET', async () => {
    const { user } = renderApp('/utils/guid');
    await user.click(await screen.findByRole('combobox', { name: '.NET format' }));
    await user.click(screen.getByRole('option', { name: /^B —/ }));
    await waitFor(() => {
      const v = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'GUIDs' }).value;
      expect(v.split('\n')[0]).toMatch(/^\{[0-9A-F-]{36}\}$/i);
    });
  });

  it('generates random strings with the chosen length and alphabet', async () => {
    const { user } = renderApp('/utils/random-string');
    const length = await screen.findByRole('spinbutton', { name: 'Length' });
    await user.clear(length);
    await user.type(length, '12');
    await user.click(screen.getByRole('combobox', { name: 'Characters' }));
    await user.click(screen.getByRole('option', { name: 'Digits only' }));
    await waitFor(() => {
      const v = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Random strings' }).value;
      expect(v.split('\n').every((l) => /^\d{12}$/.test(l))).toBe(true);
    });
  });

  it('generates passwords, regenerates and never records history', async () => {
    const { user } = renderApp('/utils/password');
    const list = await screen.findByRole('list', { name: 'Generated passwords' });
    const first = within(list).getAllByRole('listitem')[0]?.textContent ?? '';
    expect(first.length).toBeGreaterThanOrEqual(16);
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')[0]?.textContent).not.toBe(first);
    });
    const copy = within(list).getAllByRole('button', { name: /copy/i })[0];
    if (copy) await user.click(copy);
    expect(await db.toolHistory.count()).toBe(0);
  });

  it('hashes text with several algorithms and compares against an expected value', async () => {
    const { user } = renderApp('/utils/hash');
    await user.type(await field('Text to hash (UTF-8)'), 'abc');
    await waitFor(() => {
      expect(rowValue('Digests', 'SHA-256')).toContain(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
    expect(rowValue('Digests', 'MD5')).toContain('900150983cd24fb0d6963f7d28e17f72');
    await user.type(
      screen.getByRole('textbox', { name: 'Compare with expected hash' }),
      'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
    );
    expect(await screen.findByText('matches')).toBeInTheDocument();
  });

  it('computes HMACs', async () => {
    const { user } = renderApp('/utils/hash');
    await user.type(
      await field('Text to hash (UTF-8)'),
      'The quick brown fox jumps over the lazy dog',
    );
    await user.type(screen.getByLabelText('HMAC key (optional)'), 'key');
    await waitFor(() => {
      expect(rowValue('Digests', 'HMAC-SHA-256')).toContain(
        'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
      );
    });
  });

  it('generates lorem ipsum by word count', async () => {
    const { user } = renderApp('/utils/lorem-ipsum');
    await user.click(await screen.findByRole('combobox', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: 'Words' }));
    const count = screen.getByRole('spinbutton', { name: 'Count' });
    await user.clear(count);
    await user.type(count, '7');
    await waitFor(() => {
      const v = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Placeholder text',
      }).value;
      expect(v.split(/\s+/).filter(Boolean)).toHaveLength(7);
    });
  });
});

describe('Date and time', () => {
  it('converts a Unix timestamp with unit detection', async () => {
    const { user } = renderApp('/utils/unix-timestamp');
    await user.type(await field('Unix timestamp'), '1700000000000');
    await waitFor(() => {
      expect(screen.getAllByText('2023-11-14T22:13:20.000Z').length).toBeGreaterThan(0);
    });
  });

  it('converts a time between zones', async () => {
    renderApp('/utils/timezone');
    expect(await screen.findByRole('table', { name: 'Converted times' })).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2);
  });

  it('computes a calendar difference with business days', async () => {
    renderApp('/utils/date-diff');
    fireEvent.change(await screen.findByLabelText('Start'), {
      target: { value: '2024-01-01T00:00' },
    });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2024-03-15T12:00' } });
    await waitFor(() => {
      expect(rowValue('Difference', 'ISO 8601 duration')).toBe('P2M14DT12H');
    });
    expect(rowValue('Difference', 'Total days')).toBe('74');
  });

  it('describes cron expressions and lists the next runs', async () => {
    const { user } = renderApp('/utils/cron');
    const input = await field('Cron expression');
    await user.clear(input);
    await user.type(input, '*/15 9-17 * * 1-5');
    await waitFor(() => {
      expect(screen.getByLabelText('Description')).toHaveTextContent(/Every 15 minutes/);
    });
    expect(
      within(screen.getByRole('list', { name: 'Next runs' })).getAllByRole('listitem'),
    ).toHaveLength(10);
    await user.clear(input);
    await user.type(input, '61 * * * *');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('Lookup utilities', () => {
  it('converts colors and checks contrast', async () => {
    const { user } = renderApp('/utils/color');
    const input = await field('Color (HEX, rgb(), hsl() or name)');
    await user.clear(input);
    await user.type(input, 'rebeccapurple');
    await waitFor(() => {
      expect(rowValue('Color formats', 'HEX')).toBe('#663399');
    });
    expect(rowValue('Color formats', 'RGB')).toBe('rgb(102, 51, 153)');
    expect(rowValue('Color formats', 'CSS name')).toBe('rebeccapurple');
    expect(screen.queryAllByText('21.00:1')).toHaveLength(0);
    await user.clear(input);
    await user.type(input, '#000');
    expect(await screen.findAllByText('21.00:1')).not.toHaveLength(0);
    await user.clear(input);
    await user.type(input, 'notacolor');
    expect(await screen.findByText('"notacolor" is not a recognized color.')).toBeInTheDocument();
  });

  it('searches MIME types and resolves file names', async () => {
    const { user } = renderApp('/utils/mime');
    await user.type(
      await screen.findByRole('searchbox', { name: /Search by extension/ }),
      'report.pdf',
    );
    expect(await screen.findByText('application/pdf', { selector: 'code' })).toBeInTheDocument();
  });

  it('parses user agents and flags bots', async () => {
    const { user } = renderApp('/utils/user-agent');
    await user.click(await screen.findByRole('button', { name: 'Safari / iPhone' }));
    await waitFor(() => {
      expect(rowValue('Parsed user agent', 'Operating system')).toBe('iOS 18.1');
    });
    expect(rowValue('Parsed user agent', 'Device type')).toMatch(/mobile/i);
    await user.click(screen.getByRole('button', { name: 'Googlebot' }));
    await waitFor(() => {
      expect(rowValue('Parsed user agent', 'Bot / tool')).toMatch(/Googlebot/);
    });
  });
});
