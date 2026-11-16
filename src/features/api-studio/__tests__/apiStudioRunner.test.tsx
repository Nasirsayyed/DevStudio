import { act, screen, waitFor, within } from '@testing-library/react';
import { saveAs } from 'file-saver';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyRequest, rowId } from '@/core/http/model';
import { db } from '@/services/db/database';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { apiHistoryRepository } from '@/services/db/repositories/apiHistoryRepository';
import { environmentsRepository } from '@/services/db/repositories/environmentsRepository';
import { OAUTH_CHANNEL } from '@/services/http/oauthChannel';
import { useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { renderApp, resetAppState } from '@/test/renderApp';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const header = (init: RequestInit | undefined, name: string) =>
  new Headers(init?.headers).get(name);

async function paste(user: ReturnType<typeof renderApp>['user'], field: HTMLElement, text: string) {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

async function savedBlobText(index = 0): Promise<{ text: string; name: string }> {
  const [blob, name] = vi.mocked(saveAs).mock.calls[index] as [Blob, string];
  return { text: await blob.text(), name };
}

/** Login (extracts a token) then profile (uses it); stored out of alphabetical order. */
async function seedCollection() {
  const c = await apiCollectionsRepository.importBundle({
    name: 'Shop API',
    description: '',
    variables: [{ id: 'cv', key: 'baseUrl', value: 'https://api.test', enabled: true }],
    folders: [],
    requests: [
      {
        folderId: null,
        draft: emptyRequest({
          name: 'Login',
          method: 'POST',
          url: '{{baseUrl}}/login',
          extract: [
            { id: rowId(), variable: 'token', source: 'json', path: '$.token', enabled: true },
          ],
          assertions: [
            { id: rowId(), kind: 'status-equals', target: '', expected: '200', enabled: true },
          ],
        }),
      },
      {
        folderId: null,
        draft: emptyRequest({
          name: 'Profile',
          url: '{{baseUrl}}/me',
          auth: { ...emptyRequest().auth, type: 'bearer', token: '{{token}}' },
          assertions: [
            {
              id: rowId(),
              kind: 'json-equals',
              target: '$.name',
              expected: '"Ada"',
              enabled: true,
            },
            { id: rowId(), kind: 'time-below', target: '', expected: '5000', enabled: true },
          ],
        }),
      },
    ],
  });
  return c;
}

function apiServer() {
  fetchMock.mockImplementation((url, init) => {
    if (url.endsWith('/login')) return Promise.resolve(json({ token: 'tok-123456' }));
    if (url.endsWith('/me'))
      return Promise.resolve(
        header(init, 'Authorization') === 'Bearer tok-123456'
          ? json({ name: 'Ada' })
          : json({ error: 'unauthorized' }, 401),
      );
    return Promise.reject(new TypeError('Failed to fetch'));
  });
}

beforeEach(async () => {
  await resetAppState();
  fetchMock.mockReset();
  vi.mocked(saveAs).mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Tests tab (assertions and chaining in the builder)', () => {
  it('evaluates assertions and stores extracted values as runtime variables', async () => {
    apiServer();
    const { user } = renderApp('/api/requests');
    await paste(
      user,
      await screen.findByRole('textbox', { name: 'URL' }),
      'https://api.test/login',
    );
    await user.click(screen.getByRole('tab', { name: 'Tests' }));
    await user.click(screen.getByRole('button', { name: 'Add assertion' }));
    await user.click(screen.getByRole('button', { name: 'Add assertion' }));
    await user.click(screen.getByRole('combobox', { name: 'Assertion 2 type' }));
    await user.click(screen.getByRole('option', { name: 'JSON value equals' }));
    await paste(user, screen.getByRole('textbox', { name: 'Assertion 2 target' }), '$.token');
    await paste(user, screen.getByRole('textbox', { name: 'Assertion 2 expected' }), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Add extraction' }));
    await paste(user, screen.getByRole('textbox', { name: 'Extraction 1 variable' }), 'token');
    await paste(user, screen.getByRole('textbox', { name: 'Extraction 1 path' }), '$.token');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const response = screen.getByRole('region', { name: 'Response' });
    await user.click(await within(response).findByRole('tab', { name: 'Tests (1/2)' }));
    const list = within(response).getByRole('list', { name: 'Assertion results' });
    expect(list).toHaveTextContent('Passed: Status in range 2xx');
    expect(list).toHaveTextContent('Failed: JSON value equals $.token wrong');
    expect(within(response).getByLabelText('Extracted variables')).toHaveTextContent(
      '{{token}}tok-123456',
    );
    expect(useApiWorkspaceStore.getState().runtime).toEqual({ token: 'tok-123456' });

    // The next request uses the extracted value.
    await paste(
      user,
      screen.getByRole('textbox', { name: 'URL' }),
      'https://api.test/me?t={{token}}',
    );
    expect(screen.queryByRole('status', { name: 'Unresolved variables' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear runtime variables (1)' }));
    expect(useApiWorkspaceStore.getState().runtime).toEqual({});
  });
});

describe('Collection Runner', () => {
  it('runs requests in order, chains extracted values and reports assertions', async () => {
    apiServer();
    const c = await seedCollection();
    const { user } = renderApp(`/api/runner?collection=${c.id}`);
    const order = () => screen.getByRole('list', { name: 'Run order' });
    await waitFor(() => {
      expect(
        within(order())
          .getAllByRole('checkbox')
          .map((c) => c.getAttribute('aria-label')),
      ).toEqual(['Include Login', 'Include Profile']);
    });
    await user.click(screen.getByRole('button', { name: 'Run (2)' }));
    const results = screen.getByRole('region', { name: 'Run results' });
    await waitFor(() => {
      expect(results).toHaveTextContent('2 passed · 0 failed · 2/2');
    });
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([
      'https://api.test/login',
      'https://api.test/me',
    ]);
    await user.click(within(results).getByRole('button', { name: 'Passed: Profile' }));
    expect(screen.getByRole('region', { name: 'Result details' })).toHaveTextContent(
      'Passed: JSON value equals $.name "Ada"',
    );
    // Runs are not recorded in the history.
    expect(await db.apiHistory.count()).toBe(0);

    await user.click(within(results).getByRole('button', { name: 'Export results' }));
    const report = JSON.parse((await savedBlobText()).text) as {
      passed: number;
      results: { name: string }[];
    };
    expect(report.passed).toBe(2);
    expect(report.results.map((r) => r.name)).toEqual(['Login', 'Profile']);

    // Reordering is saved; the profile now runs without a token and fails.
    await user.click(screen.getByRole('button', { name: 'Move Profile up' }));
    await waitFor(() => {
      expect(within(order()).getAllByRole('checkbox')[0]).toHaveAccessibleName('Include Profile');
    });
    await user.click(screen.getByRole('switch', { name: 'Stop on failure' }));
    await user.click(screen.getByRole('button', { name: 'Run (2)' }));
    await waitFor(() => {
      expect(results).toHaveTextContent('Stopped at the first failure.');
    });
    expect(results).toHaveTextContent('0 passed · 1 failed · 1/2');
    expect((await db.collections.get(c.id))?.runOrder?.length).toBe(2);
  });

  it('runs several iterations, skips excluded requests and reports network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const c = await seedCollection();
    const { user } = renderApp(`/api/runner?collection=${c.id}`);
    await user.click(await screen.findByRole('checkbox', { name: 'Include Profile' }));
    const iterations = screen.getByRole('spinbutton', { name: 'Iterations' });
    await user.tripleClick(iterations);
    await user.keyboard('3');
    await user.click(screen.getByRole('button', { name: 'Run (3)' }));
    const results = screen.getByRole('region', { name: 'Run results' });
    await waitFor(() => {
      expect(results).toHaveTextContent('0 passed · 3 failed · 3/3');
    });
    expect(within(results).getAllByText('Iteration 3')).toHaveLength(1);
    await user.click(
      within(results).getAllByRole('button', { name: 'Failed: Login' })[0] as HTMLElement,
    );
    expect(screen.getByRole('region', { name: 'Result details' })).toHaveTextContent(/CORS/);
  });
});

describe('collection import and export', () => {
  it('imports a Postman collection, ignoring scripts, and exports it without credentials', async () => {
    const postman = {
      info: {
        name: 'From Postman',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      event: [{ listen: 'test', script: { exec: ['pm.test("x")'] } }],
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'List users',
              request: {
                method: 'GET',
                url: 'https://api.test/users',
                auth: { type: 'bearer', bearer: [{ key: 'token', value: 'pm-secret' }] },
              },
            },
          ],
        },
      ],
    };
    const { user } = renderApp('/api/requests');
    const nav = await screen.findByRole('navigation', { name: 'Collections' });
    await user.click(within(nav).getByRole('button', { name: 'Import collection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import collection' });
    await paste(
      user,
      within(dialog).getByRole('textbox', { name: 'Or paste the collection JSON' }),
      JSON.stringify(postman),
    );
    expect(within(dialog).getByLabelText('Import preview')).toHaveTextContent(
      'From Postman (Postman): 1 requests, 1 folders, 0 variables.',
    );
    expect(dialog).toHaveTextContent(/never runs imported code/);
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Imported "From Postman" (1 requests).')).toBeInTheDocument();
    expect(await within(nav).findByRole('button', { name: 'Folder Users' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'GET List users' })).toBeInTheDocument();

    await user.click(
      within(nav).getByRole('button', { name: 'Actions for collection From Postman' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Export (Postman v2.1)' }));
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled();
    });
    const { text, name } = await savedBlobText();
    expect(name).toBe('From-Postman.postman_collection.json');
    expect(text).toContain('List users');
    expect(text).not.toContain('pm-secret');

    await user.click(
      within(nav).getByRole('button', { name: 'Actions for collection From Postman' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Export (DevStudio JSON)' }));
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalledTimes(2);
    });
    expect((await savedBlobText(1)).text).toContain('"format": "devstudio.api-collection"');
  });

  it('rejects files that are not collections', async () => {
    const { user } = renderApp('/api/requests');
    const nav = await screen.findByRole('navigation', { name: 'Collections' });
    await user.click(within(nav).getByRole('button', { name: 'Import collection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import collection' });
    await paste(
      user,
      within(dialog).getByRole('textbox', { name: 'Or paste the collection JSON' }),
      '{"hello": 1}',
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/Unknown file/);
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });
});

describe('OAuth 2.0', () => {
  async function chooseOAuth(user: ReturnType<typeof renderApp>['user']) {
    await paste(user, await screen.findByRole('textbox', { name: 'URL' }), 'https://api.test/me');
    await user.click(screen.getByRole('tab', { name: 'Auth' }));
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(screen.getByRole('option', { name: 'OAuth 2.0' }));
  }

  it('gets a client-credentials token, keeps it in memory and sends it', async () => {
    fetchMock.mockImplementation((url) =>
      Promise.resolve(
        url === 'https://auth.test/token'
          ? json({ access_token: 'at-777', expires_in: 3600 })
          : json({ ok: true }),
      ),
    );
    const { user } = renderApp('/api/requests');
    await chooseOAuth(user);
    await paste(user, screen.getByLabelText('Token URL'), 'https://auth.test/token');
    await paste(user, screen.getByLabelText('Client ID'), 'cli');
    await paste(user, screen.getByLabelText('Client secret'), 'sec');
    await user.click(screen.getByRole('button', { name: 'Get access token' }));
    expect(
      await screen.findByText(/Access token received\. It expires in 60 min/),
    ).toBeInTheDocument();
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] ?? [];
    expect(tokenUrl).toBe('https://auth.test/token');
    expect(tokenInit?.method).toBe('POST');
    expect(header(tokenInit, 'Authorization')).toBe(`Basic ${btoa('cli:sec')}`);
    expect(screen.getByLabelText('Token status')).toHaveTextContent('Token ready');

    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(header(fetchMock.mock.calls[1]?.[1], 'Authorization')).toBe('Bearer at-777');
    await waitFor(async () => {
      expect(await db.apiHistory.count()).toBe(1);
    });
    expect(JSON.stringify(await db.apiHistory.toArray())).not.toContain('at-777');
  });

  it('runs the authorization code flow with PKCE through the callback page', async () => {
    fetchMock.mockResolvedValue(json({ access_token: 'pkce-token' }));
    let authUrl = '';
    const open = vi.spyOn(window, 'open').mockImplementation((url) => {
      authUrl = String(url);
      return window;
    });
    const { user } = renderApp('/api/requests');
    await chooseOAuth(user);
    await user.click(screen.getByRole('combobox', { name: 'Grant type' }));
    await user.click(screen.getByRole('option', { name: 'Authorization code (PKCE)' }));
    await paste(user, screen.getByLabelText('Authorization URL'), 'https://auth.test/authorize');
    await paste(user, screen.getByLabelText('Token URL'), 'https://auth.test/token');
    await paste(user, screen.getByLabelText('Client ID'), 'spa');
    await user.click(screen.getByRole('button', { name: 'Get access token' }));
    await waitFor(() => {
      expect(authUrl).not.toBe('');
    });
    const params = new URL(authUrl).searchParams;
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('redirect_uri')).toBe(`${window.location.origin}/oauth/callback`);

    // A redirect with a different state is ignored; the right one completes the sign-in.
    const channel = new BroadcastChannel(OAUTH_CHANNEL);
    channel.postMessage({ type: 'oauth-callback', search: '?code=evil&state=forged' });
    channel.postMessage({
      type: 'oauth-callback',
      search: `?code=good&state=${params.get('state') ?? ''}`,
    });
    channel.close();
    expect(await screen.findByText(/Access token received/)).toBeInTheDocument();
    const sent = fetchMock.mock.calls[0]?.[1]?.body;
    const body = new URLSearchParams(typeof sent === 'string' ? sent : '');
    expect(body.get('code')).toBe('good');
    expect(body.get('code_verifier')).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(useApiWorkspaceStore.getState().draft.auth.oauth2.accessToken).toBe('pkce-token');
    open.mockRestore();
  });

  it('the callback page relays the redirect to the waiting tab', async () => {
    const received = new Promise<unknown>((resolve) => {
      const channel = new BroadcastChannel(OAUTH_CHANNEL);
      channel.onmessage = (e) => {
        resolve(e.data);
        channel.close();
      };
    });
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const { router } = renderApp('/oauth/callback?code=abc&state=s1');
    expect(await screen.findByRole('heading', { name: 'Sign-in finished' })).toBeInTheDocument();
    expect(await received).toEqual({ type: 'oauth-callback', search: '?code=abc&state=s1' });
    // The code is removed from the address.
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    close.mockRestore();
  });
});

describe('Response Compare', () => {
  it('compares two history responses structurally', async () => {
    const record = (body: unknown, status: number) =>
      apiHistoryRepository.record({
        requestId: null,
        snapshot: {
          request: {
            method: 'GET',
            url: `https://api.test/v${String(status)}`,
            headers: [],
            body: null,
          },
          response: {
            status,
            statusText: '',
            headers: [['content-type', 'application/json']],
            contentType: 'application/json',
            body: JSON.stringify(body),
            bodyTruncated: false,
            sizeBytes: 10,
            durationMs: 5,
          },
          error: null,
          draft: null,
          environment: null,
        },
      });
    const a = await record({ id: 1, name: 'Ada', tags: ['x'] }, 200);
    await record({ name: 'Ada', id: 2 }, 201);
    const { user } = renderApp(`/api/compare?left=${a.id}`);
    await user.click(await screen.findByRole('combobox', { name: 'Right response' }));
    await user.click(
      await screen.findByRole('option', { name: /^201 GET https:\/\/api\.test\/v201/ }),
    );
    const summary = await screen.findByRole('status', { name: 'Comparison summary' });
    expect(summary).toHaveTextContent('Bodies differ');
    expect(summary).toHaveTextContent('0 added · 1 removed · 1 changed');
    expect(summary).toHaveTextContent('Status: 200 → 201');
    await user.click(screen.getByRole('tab', { name: 'Differences (2)' }));
    const table = screen.getByRole('table', { name: 'JSON differences' });
    expect(table).toHaveTextContent('$.id');
    expect(table).toHaveTextContent('$.tags');
  });

  it('compares pasted bodies and opens from the history', async () => {
    const { user, router } = renderApp('/api/compare');
    await paste(
      user,
      await screen.findByRole('textbox', { name: 'Left response body' }),
      '{"a":1,"b":2}',
    );
    await paste(
      user,
      screen.getByRole('textbox', { name: 'Right response body' }),
      '{"b":2,"a":1}',
    );
    expect(await screen.findByRole('status', { name: 'Comparison summary' })).toHaveTextContent(
      'Bodies are equal',
    );
    await act(() => router.navigate('/api/history'));
    expect(await screen.findByText('No requests yet')).toBeInTheDocument();
  });
});

describe('Environments integration with the runner', () => {
  it('uses the active environment and masks its secrets in reports', async () => {
    await environmentsRepository.ensureDefaults();
    const dev = (await environmentsRepository.list()).find((e) => e.name === 'Development');
    if (!dev) throw new Error('missing');
    await environmentsRepository.save({
      id: dev.id,
      name: dev.name,
      persistSecrets: false,
      variables: [
        { id: 'k', key: 'apiKey', value: 'super-secret-key', enabled: true, secret: true },
      ],
    });
    usePreferencesStore.getState().setSelectedEnvironmentId(dev.id);
    fetchMock.mockResolvedValue(json({ ok: true }));
    const c = await apiCollectionsRepository.importBundle({
      name: 'Keys',
      description: '',
      variables: [],
      folders: [],
      requests: [
        {
          folderId: null,
          draft: emptyRequest({ name: 'Q', url: 'https://api.test/q?key={{apiKey}}' }),
        },
      ],
    });
    const { user } = renderApp(`/api/runner?collection=${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Run (1)' }));
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Run results' })).toHaveTextContent('1 passed');
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/q?key=super-secret-key');
    await user.click(screen.getByRole('button', { name: 'Export results' }));
    expect((await savedBlobText()).text).not.toContain('super-secret-key');
  });
});
