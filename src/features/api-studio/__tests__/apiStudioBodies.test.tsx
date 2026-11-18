import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

async function paste(user: ReturnType<typeof renderApp>['user'], field: HTMLElement, text: string) {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

async function start(method = 'POST') {
  const r = renderApp('/api/requests');
  const { user } = r;
  await paste(user, await screen.findByRole('textbox', { name: 'URL' }), 'https://api.test/x');
  if (method !== 'GET') {
    await user.click(screen.getByRole('combobox', { name: 'Method' }));
    await user.click(screen.getByRole('option', { name: method }));
  }
  await user.click(screen.getByRole('tab', { name: 'Body' }));
  return r;
}

const sent = async () => {
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });
  return fetchMock.mock.calls[0]?.[1];
};

beforeEach(async () => {
  await resetAppState();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request bodies', () => {
  it('sends URL-encoded forms', async () => {
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: 'URL-encoded' }));
    await paste(user, screen.getByRole('textbox', { name: 'Form fields key 1' }), 'a b');
    await paste(user, screen.getByRole('textbox', { name: 'Form fields value 1' }), 'c&d');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const init = await sent();
    expect(init?.body).toBe('a+b=c%26d');
    expect(new Headers(init?.headers).get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );
  });

  it('sends multipart form data with files, and rejects oversized or missing files', async () => {
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: 'Form data' }));
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await paste(user, screen.getByRole('textbox', { name: 'Form field name 1' }), 'note');
    await paste(user, screen.getByRole('textbox', { name: 'Form field value 1' }), 'hello');
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await paste(user, screen.getByRole('textbox', { name: 'Form field name 2' }), 'doc');
    await user.click(screen.getByRole('combobox', { name: 'Form field type 2' }));
    await user.click(screen.getByRole('option', { name: 'File' }));

    // Sending without the file explains what is missing.
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(
      await within(screen.getByRole('region', { name: 'Response' })).findByRole('alert'),
    ).toHaveTextContent('Choose a file for the form field "doc".');

    const picker = screen.getByLabelText('File for form field 2');
    const big = new File(['x'], 'big.bin');
    Object.defineProperty(big, 'size', { value: 300 * 1024 * 1024 });
    await user.upload(picker, big);
    expect(await screen.findByText(/"big.bin" is 300 MB; the limit is 200 MB/)).toBeInTheDocument();

    await user.upload(picker, new File(['PDF'], 'a.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('button', { name: /a\.pdf/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const init = await sent();
    const form = init?.body as FormData;
    expect(form.get('note')).toBe('hello');
    expect((form.get('doc') as File).name).toBe('a.pdf');
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('sends GraphQL queries and validates their variables', async () => {
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: 'GraphQL' }));
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'GraphQL query' }),
      'query { me { id } }',
    );
    await setEditorText(user, screen.getByRole('textbox', { name: 'GraphQL variables' }), '{bad');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(
      await within(screen.getByRole('region', { name: 'Response' })).findByRole('alert'),
    ).toHaveTextContent(/variables/i);
    await setEditorText(
      user,
      screen.getByRole('textbox', { name: 'GraphQL variables' }),
      '{"x":1}',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const body = (await sent())?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({
      query: 'query { me { id } }',
      variables: { x: 1 },
    });
  });

  it('sends a binary file as the body', async () => {
    const { user } = await start('PUT');
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.upload(
      screen.getByLabelText('File to send'),
      new File(['bytes'], 'data.bin', { type: 'application/octet-stream' }),
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const init = await sent();
    expect((init?.body as File).name).toBe('data.bin');
  });

  it('warns that GET requests cannot have a body', async () => {
    const { user } = await start('GET');
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    expect(screen.getByText(/GET and HEAD requests cannot have a body/i)).toBeInTheDocument();
  });
});

describe('response views', () => {
  async function send(user: ReturnType<typeof renderApp>['user']) {
    await paste(user, await screen.findByRole('textbox', { name: 'URL' }), 'https://api.test/r');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    return screen.getByRole('region', { name: 'Response' });
  }

  it('shows JSON as pretty text, raw and a tree', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"user":{"name":"Ada"}}', { headers: { 'Content-Type': 'application/json' } }),
    );
    const { user } = renderApp('/api/requests');
    const response = await send(user);
    await waitFor(() => {
      expect(
        within(response).getByRole<HTMLTextAreaElement>('textbox', { name: 'Response body' }).value,
      ).toContain('\n  "user"');
    });
    await user.click(within(response).getByRole('button', { name: 'Raw' }));
    expect(
      within(response).getByRole<HTMLTextAreaElement>('textbox', { name: 'Response body' }).value,
    ).toBe('{"user":{"name":"Ada"}}');
    await user.click(within(response).getByRole('button', { name: 'Tree' }));
    expect(
      await within(response).findByRole('tree', { name: 'Response JSON tree' }),
    ).toHaveTextContent('user');
    await user.click(within(response).getByRole('tab', { name: 'Request' }));
    expect(within(response).getByLabelText('Sent request line')).toHaveTextContent(
      'GET https://api.test/r',
    );
  });

  it('previews HTML in a sandbox without scripts', async () => {
    fetchMock.mockResolvedValue(
      new Response('<h1>Hi</h1><script>alert(1)</script>', {
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    const { user } = renderApp('/api/requests');
    const response = await send(user);
    const frame = await within(response).findByTitle('Response preview');
    expect(frame.getAttribute('sandbox')).not.toMatch(/allow-scripts|allow-same-origin/);
    expect(frame.getAttribute('srcdoc')).toContain('<h1>Hi</h1>');
    expect(frame.getAttribute('srcdoc')).not.toContain('<script>');
  });

  it('offers binary bodies as a download and handles empty bodies', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([0, 1, 2, 255]), {
        headers: { 'Content-Type': 'application/zip' },
      }),
    );
    const { user } = renderApp('/api/requests');
    const response = await send(user);
    expect(await within(response).findByText('Binary content (4 B)')).toBeInTheDocument();
    expect(within(response).getByRole('button', { name: 'Download file' })).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await within(response).findByText('Empty body')).toBeInTheDocument();
  });
});
