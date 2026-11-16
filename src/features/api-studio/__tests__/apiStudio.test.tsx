import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/services/db/database';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import { environmentsRepository } from '@/services/db/repositories/environmentsRepository';
import { emptyRequest } from '@/core/http/model';
import { useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { renderApp, resetAppState } from '@/test/renderApp';

// The executor always passes the URL as a string.
type FetchArgs = [string, RequestInit | undefined];
const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>();

const json = (value: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

async function paste(user: ReturnType<typeof renderApp>['user'], field: HTMLElement, text: string) {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

/** Development environment with a base URL and an in-memory secret token. */
async function useDevEnvironment() {
  await environmentsRepository.ensureDefaults();
  const dev = (await environmentsRepository.list()).find((e) => e.name === 'Development');
  if (!dev) throw new Error('no Development environment');
  await environmentsRepository.save({
    id: dev.id,
    name: dev.name,
    persistSecrets: false,
    variables: [
      { id: 'v1', key: 'baseUrl', value: 'https://api.test', enabled: true, secret: false },
      { id: 'v2', key: 'token', value: 's3cret-token', enabled: true, secret: true },
    ],
  });
  usePreferencesStore.getState().setSelectedEnvironmentId(dev.id);
  return dev.id;
}

beforeEach(async () => {
  await resetAppState();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Request Builder', () => {
  it('resolves environment variables, sends the request and shows the response', async () => {
    await useDevEnvironment();
    fetchMock.mockResolvedValue(json({ items: [1, 2] }, { headers: { 'X-Trace': 'abc' } }));
    const { user } = renderApp('/api/requests');
    const url = await screen.findByRole('textbox', { name: 'URL' });
    await paste(user, url, '{{baseUrl}}/items?page=2');
    await user.click(screen.getByRole('tab', { name: 'Auth' }));
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(screen.getByRole('option', { name: 'Bearer token' }));
    await paste(user, screen.getByLabelText('Token'), '{{token}}');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const response = screen.getByRole('region', { name: 'Response' });
    await waitFor(() => {
      expect(within(response).getByLabelText('Status')).toHaveTextContent('200');
    });
    const [target, init] = fetchMock.mock.calls[0] ?? [];
    expect(target).toBe('https://api.test/items?page=2');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer s3cret-token');
    expect(init?.credentials).toBe('omit');
    await waitFor(() => {
      expect(
        within(response).getByRole<HTMLTextAreaElement>('textbox', { name: 'Response body' }).value,
      ).toBe('{\n  "items": [\n    1,\n    2\n  ]\n}');
    });
    await user.click(within(response).getByRole('tab', { name: /Headers/ }));
    expect(within(response).getByRole('table', { name: 'Response headers' })).toHaveTextContent(
      'x-traceabc',
    );

    // History keeps the request without the secret.
    await waitFor(async () => {
      expect(await db.apiHistory.count()).toBe(1);
    });
    const [entry] = await db.apiHistory.toArray();
    expect(JSON.stringify(entry)).not.toContain('s3cret-token');
    expect(entry).toMatchObject({
      method: 'GET',
      status: 200,
      url: 'https://api.test/items?page=2',
    });
  });

  it('flags undefined variables and explains CORS failures without bypassing them', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { user } = renderApp('/api/requests');
    const url = await screen.findByRole('textbox', { name: 'URL' });
    await paste(user, url, 'https://other.example/{{missingVar}}');
    expect(screen.getByRole('status', { name: 'Unresolved variables' })).toHaveTextContent(
      '{{missingVar}}',
    );
    await paste(user, url, 'https://other.example/data');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/CORS/);
    expect(screen.getByRole('alert')).toHaveTextContent('does not bypass CORS');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(async () => {
      expect((await db.apiHistory.toArray())[0]?.status).toBeNull();
    });
  });

  it('saves to a collection without credentials unless the user agrees, and reopens it', async () => {
    fetchMock.mockResolvedValue(json({}));
    const { user, router } = renderApp('/api/requests');
    await paste(user, await screen.findByRole('textbox', { name: 'URL' }), 'https://api.test/me');
    await user.click(screen.getByRole('tab', { name: 'Auth' }));
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(screen.getByRole('option', { name: 'Bearer token' }));
    await paste(user, screen.getByLabelText('Token'), 'literal-token');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const dialog = await screen.findByRole('dialog', { name: 'Save request' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Who am I');
    expect(within(dialog).getByText(/By default they are/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved "Who am I"')).toBeInTheDocument();

    const [saved] = await db.apiRequests.toArray();
    expect(saved).toMatchObject({ name: 'Who am I', url: 'https://api.test/me' });
    expect(JSON.stringify(saved)).not.toContain('literal-token');
    expect((await db.collections.toArray())[0]?.name).toBe('My collection');
    // The token stays usable in this session.
    expect(useApiWorkspaceStore.getState().draft.auth.token).toBe('literal-token');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const nav = screen.getByRole('navigation', { name: 'Collections' });
    expect(within(nav).getByRole('button', { name: 'GET Who am I' })).toBeInTheDocument();

    // A palette link opens the saved request.
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'URL' })).toHaveValue('');
    });
    await act(() => router.navigate(`/api/requests?request=${saved?.id ?? ''}`));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'URL' })).toHaveValue('https://api.test/me');
    });
    expect(screen.getByLabelText('Open request')).toHaveTextContent('Who am I');
  });

  it('keeps credentials only with explicit consent', async () => {
    const { user } = renderApp('/api/requests');
    await paste(user, await screen.findByRole('textbox', { name: 'URL' }), 'https://api.test/');
    await user.click(screen.getByRole('tab', { name: 'Auth' }));
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(screen.getByRole('option', { name: 'Basic' }));
    await paste(user, screen.getByLabelText('Username'), 'ada');
    await paste(user, screen.getByLabelText('Password'), 'pa55');
    await user.keyboard('{Control>}s{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Save request' });
    await user.click(within(dialog).getByRole('checkbox', { name: /Save the credentials/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText(/^Saved "/);
    const [saved] = await db.apiRequests.toArray();
    expect(saved?.config).toMatchObject({
      auth: { type: 'basic', username: 'ada', password: 'pa55' },
    });
  });

  it('imports cURL commands and generates code snippets', async () => {
    const { user } = renderApp('/api/requests');
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import cURL…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import cURL command' });
    await paste(
      user,
      within(dialog).getByRole('textbox', { name: 'cURL command' }),
      `curl https://api.test/items -H 'Accept: application/json' --data '{"a":1}'`,
    );
    expect(within(dialog).getByLabelText('Parsed request')).toHaveTextContent(
      'POST https://api.test/items',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('textbox', { name: 'URL' })).toHaveValue(
      'https://api.test/items',
    );
    expect(useApiWorkspaceStore.getState().draft).toMatchObject({
      method: 'POST',
      body: { mode: 'json', raw: '{"a":1}' },
    });

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('menuitem', { name: /Code snippet/ }));
    const snippet = await screen.findByRole('dialog', { name: 'Code snippet' });
    await user.click(within(snippet).getByRole('tab', { name: 'Python (requests)' }));
    expect(
      within(snippet).getByRole<HTMLTextAreaElement>('textbox', { name: 'Generated code' }).value,
    ).toContain('requests.request(');
  });

  it('keeps the draft without credentials across reloads', async () => {
    renderApp('/api/requests');
    await screen.findByRole('textbox', { name: 'URL' });
    useApiWorkspaceStore.getState().setDraft(
      emptyRequest({
        url: 'https://api.test/x',
        auth: { ...emptyRequest().auth, type: 'bearer', token: 'tok' },
      }),
    );
    await waitFor(async () => {
      expect(await db.settings.get('apiStudio.draft')).toBeDefined();
    });
    const stored = JSON.stringify(await db.settings.get('apiStudio.draft'));
    expect(stored).toContain('https://api.test/x');
    expect(stored).not.toContain('"tok"');
  });
});

describe('Collections', () => {
  it('creates collections and folders, saves into a folder and deletes the folder', async () => {
    const { user } = renderApp('/api/requests');
    const nav = await screen.findByRole('navigation', { name: 'Collections' });
    await user.click(
      within(nav).getAllByRole('button', { name: 'New collection' })[0] as HTMLElement,
    );
    let dialog = await screen.findByRole('dialog', { name: 'New collection' });
    await paste(user, within(dialog).getByRole('textbox', { name: 'Name' }), 'Billing');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await user.click(
      await within(nav).findByRole('button', { name: 'Actions for collection Billing' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'New folder' }));
    dialog = await screen.findByRole('dialog', { name: 'New folder' });
    await paste(user, within(dialog).getByRole('textbox', { name: 'Name' }), 'Invoices');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await user.click(
      await within(nav).findByRole('button', { name: 'Actions for folder Invoices' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'New request here' }));

    await paste(user, screen.getByRole('textbox', { name: 'URL' }), 'https://api.test/invoices');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const save = await screen.findByRole('dialog', { name: 'Save request' });
    expect(within(save).getByRole('combobox', { name: 'Collection' })).toHaveTextContent('Billing');
    expect(within(save).getByRole('combobox', { name: 'Folder' })).toHaveTextContent('Invoices');
    await user.click(within(save).getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved "New request"');
    const [saved] = await db.apiRequests.toArray();
    const [collection] = await db.collections.toArray();
    expect(saved?.folderId).toBe(collection?.folders[0]?.id);

    await user.click(within(nav).getByRole('button', { name: 'Actions for folder Invoices' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(async () => {
      expect(await db.apiRequests.count()).toBe(0);
    });
    // The open request is no longer saved anywhere.
    await waitFor(() => {
      expect(useApiWorkspaceStore.getState().open).toBeNull();
    });
    expect(await apiCollectionsRepository.listCollections()).toHaveLength(1);
  });
});

describe('Environments', () => {
  it('keeps secret values in memory unless the user consents to storing them', async () => {
    const { user } = renderApp('/api/environments');
    const list = await screen.findByRole('list', { name: 'Environments' });
    await waitFor(() => {
      expect(within(list).getAllByRole('button')).toHaveLength(4);
    });
    await user.click(within(list).getByRole('button', { name: /Staging/ }));
    const form = screen.getByRole('form', { name: 'Environment Staging' });
    await paste(
      user,
      within(form).getByRole('textbox', { name: 'Variables variable 2' }),
      'apiKey',
    );
    await paste(user, within(form).getByRole('textbox', { name: 'Variables value 2' }), 'k-123456');
    await user.click(within(form).getByRole('button', { name: 'Secret Variables row 2' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved "Staging"');
    const stored = await db.environments.where('name').equals('Staging').first();
    expect(stored?.variables.find((v) => v.key === 'apiKey')).toMatchObject({
      secret: true,
      value: '',
    });
    // Still available in this tab.
    const listed = (await environmentsRepository.list()).find((e) => e.name === 'Staging');
    expect(listed?.variables.find((v) => v.key === 'apiKey')?.value).toBe('k-123456');

    await user.click(
      within(form).getByRole('switch', { name: 'Remember secret values on this device' }),
    );
    const consent = await screen.findByRole('dialog', { name: 'Store secret values?' });
    await user.click(within(consent).getByRole('button', { name: 'Store in plain text' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      const again = await db.environments.where('name').equals('Staging').first();
      expect(again?.variables.find((v) => v.key === 'apiKey')?.value).toBe('k-123456');
    });

    await user.click(within(form).getByRole('button', { name: 'Use this environment' }));
    expect(within(form).getByText('Active')).toBeInTheDocument();
  });

  it('creates, validates and deletes custom environments', async () => {
    const { user } = renderApp('/api/environments');
    await user.click(await screen.findByRole('button', { name: 'New environment' }));
    const form = await screen.findByRole('form', { name: 'Environment Custom 1' });
    await paste(user, within(form).getByRole('textbox', { name: 'Variables variable 1' }), '1bad');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/is not a valid variable name/)).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Delete environment' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(async () => {
      expect(await db.environments.where('name').equals('Custom 1').count()).toBe(0);
    });
  });
});

describe('Request History', () => {
  it('lists sent requests, filters them and reopens one in the builder', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ error: 'nope' }, { status: 404 }));
    const { user, router } = renderApp('/api/requests');
    const url = await screen.findByRole('textbox', { name: 'URL' });
    await paste(user, url, 'https://api.test/one');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Status')).toHaveTextContent('200');
    });
    await paste(user, url, 'https://api.test/two');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Status')).toHaveTextContent('404');
    });
    await waitFor(async () => {
      expect(await db.apiHistory.count()).toBe(2);
    });

    await act(() => router.navigate('/api/history'));
    const list = await screen.findByRole('list', { name: 'History' });
    await waitFor(() => {
      expect(within(list).getAllByRole('button')).toHaveLength(2);
    });
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: '4xx' }));
    await waitFor(() => {
      expect(within(list).getAllByRole('button')).toHaveLength(1);
    });
    expect(screen.getByLabelText('Request line')).toHaveTextContent('GET https://api.test/two');
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'History response body' }).value,
    ).toContain('nope');

    await user.click(screen.getByRole('button', { name: 'Open in Request Builder' }));
    // The builder still holds the last (unsaved) request.
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Request Builder' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: 'URL' })).toHaveValue('https://api.test/two');

    await act(() => router.navigate('/api/history'));
    const clear = await screen.findByRole('button', { name: 'Clear history' });
    await waitFor(() => {
      expect(clear).toBeEnabled();
    });
    await user.click(clear);
    const confirmClear = await screen.findByRole('dialog', { name: 'Clear the request history?' });
    await user.click(within(confirmClear).getByRole('button', { name: 'Clear history' }));
    expect(await screen.findByText('No requests yet')).toBeInTheDocument();
  });
});
