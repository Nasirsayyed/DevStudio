import { describe, expect, it } from 'vitest';
import { compareResponses, type ResponseSide } from './compare';
import { evaluateAssertions, extractValues, type ResponseFacts } from './assertions';
import {
  exportNative,
  exportPostman,
  importCollection,
  type CollectionBundle,
} from './collections';
import { emptyRequest, type Assertion, type Extraction } from './model';
import {
  authorizationUrl,
  createPkce,
  createState,
  parseCallback,
  parseTokenResponse,
  tokenRequest,
  validateOAuthConfig,
} from './oauth';

const facts = (patch: Partial<ResponseFacts> = {}): ResponseFacts => ({
  status: 201,
  headers: [
    ['content-type', 'application/json; charset=utf-8'],
    ['x-request-id', 'r-1'],
  ],
  text: JSON.stringify({
    id: 7,
    name: 'Ada',
    tags: ['a', 'b'],
    nested: { ok: true },
    items: [{ n: 1 }],
  }),
  timeMs: 120,
  ...patch,
});

let n = 0;
const a = (
  kind: Assertion['kind'],
  target: string,
  expected: string,
  enabled = true,
): Assertion => ({
  id: `a${String(++n)}`,
  kind,
  target,
  expected,
  enabled,
});

describe('assertions', () => {
  it('checks status, JSON, headers, body and time', () => {
    const results = evaluateAssertions(
      [
        a('status-equals', '', '200, 201'),
        a('status-in-range', '', '2xx'),
        a('status-in-range', '', '400-499'),
        a('json-equals', '$.id', '7'),
        a('json-equals', '$.name', 'Ada'),
        a('json-equals', '$.nested', '{"ok": true}'),
        a('json-exists', '$.missing', ''),
        a('json-contains', '$.tags', '"b"'),
        a('json-contains', '$.name', 'Ad'),
        a('header-contains', 'Content-Type', 'JSON'),
        a('header-contains', 'x-missing', 'x'),
        a('body-contains', '', '"Ada"'),
        a('time-below', '', '100'),
        a('status-equals', '', '500', false),
      ],
      facts(),
    );
    expect(results.map((r) => r.passed)).toEqual([
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      false,
    ]);
    expect(results[2]?.detail).toBe('Status 201');
    expect(results[10]?.detail).toMatch(/not present/);
    expect(results[12]?.detail).toBe('120 ms');
  });

  it('reports malformed input instead of throwing', () => {
    const results = evaluateAssertions(
      [
        a('json-exists', '$.id', ''),
        a('json-equals', 'id', '1'),
        a('status-equals', '', 'ok'),
        a('status-in-range', '', '2-3'),
        a('time-below', '', '-5'),
      ],
      facts({ text: '<html>' }),
    );
    expect(results.every((r) => !r.passed)).toBe(true);
    expect(results[0]?.detail).toBe('The body is not JSON.');
    expect(results[2]?.detail).toMatch(/status code/);
  });

  it('resolves variables in targets and expectations', () => {
    const [r] = evaluateAssertions([a('json-equals', '$.name', '{{who}}')], facts(), (t) =>
      t.replace('{{who}}', 'Ada'),
    );
    expect(r).toMatchObject({ passed: true, label: 'JSON value equals $.name Ada' });
  });

  it('ignores prototype pollution in bodies', () => {
    const [r] = evaluateAssertions(
      [a('json-exists', '$.__proto__', '')],
      facts({ text: '{"__proto__": {"x": 1}}' }),
    );
    expect(r?.passed).toBe(false);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe('extractions', () => {
  const e = (variable: string, source: Extraction['source'], path: string): Extraction => ({
    id: variable,
    variable,
    source,
    path,
    enabled: true,
  });

  it('reads JSON values, headers and the status for chaining', () => {
    const r = extractValues(
      [
        e('userId', 'json', '$.id'),
        e('name', 'json', '$.name'),
        e('nested', 'json', '$.nested'),
        e('reqId', 'header', 'X-Request-Id'),
        e('code', 'status', ''),
        e('nope', 'json', '$.missing'),
        e('1bad', 'status', ''),
      ],
      facts(),
    );
    expect(r.values).toEqual({
      userId: '7',
      name: 'Ada',
      nested: '{"ok":true}',
      reqId: 'r-1',
      code: '201',
    });
    expect(r.errors).toEqual([
      'nope: nothing matches $.missing.',
      '"1bad" is not a valid variable name.',
    ]);
  });
});

const sampleBundle = (): CollectionBundle => ({
  name: 'Shop',
  description: 'Demo',
  variables: [{ id: 'v', key: 'baseUrl', value: 'https://api.test', enabled: true }],
  folders: [
    { id: 'f1', name: 'Orders', parentId: null },
    { id: 'f2', name: 'Admin', parentId: 'f1' },
  ],
  requests: [
    {
      folderId: 'f2',
      draft: emptyRequest({
        name: 'Create order',
        method: 'POST',
        url: '{{baseUrl}}/orders',
        params: [{ id: 'p', key: 'dry', value: '1', enabled: true }],
        headers: [{ id: 'h', key: 'X-Trace', value: 'on', enabled: false }],
        body: { ...emptyRequest().body, mode: 'json', raw: '{"a":1}' },
        auth: { ...emptyRequest().auth, type: 'bearer', token: 'secret-literal' },
        assertions: [a('status-equals', '', '201')],
      }),
    },
    {
      folderId: null,
      draft: emptyRequest({
        name: 'Login',
        auth: { ...emptyRequest().auth, type: 'basic', username: 'u', password: '{{password}}' },
      }),
    },
  ],
});

describe('collection import and export', () => {
  it('round-trips the native format without credentials', () => {
    const text = exportNative(sampleBundle(), new Date('2026-01-01T00:00:00Z'));
    expect(text).not.toContain('secret-literal');
    const { bundle, format, warnings } = importCollection(text);
    expect(format).toBe('devstudio');
    expect(warnings).toEqual([]);
    expect(bundle.folders).toEqual(sampleBundle().folders);
    expect(bundle.requests[0]?.folderId).toBe('f2');
    expect(bundle.requests[0]?.draft).toMatchObject({
      method: 'POST',
      assertions: [{ kind: 'status-equals' }],
    });
    expect(bundle.requests[1]?.draft.auth.password).toBe('{{password}}');
  });

  it('round-trips through Postman v2.1', () => {
    const text = exportPostman(sampleBundle());
    expect(text).not.toContain('secret-literal');
    const parsed = JSON.parse(text) as { info: { schema: string } };
    expect(parsed.info.schema).toContain('v2.1.0');
    const { bundle, format } = importCollection(text);
    expect(format).toBe('postman');
    expect(bundle.folders.map((f) => f.name)).toEqual(['Orders', 'Admin']);
    const create = bundle.requests.find((r) => r.draft.name === 'Create order');
    expect(create?.draft).toMatchObject({
      method: 'POST',
      url: '{{baseUrl}}/orders?dry=1',
      body: { mode: 'json', raw: '{"a":1}' },
      auth: { type: 'bearer', token: '' },
      headers: [{ key: 'X-Trace', value: 'on', enabled: false }],
    });
    expect(create?.folderId).toBe(bundle.folders[1]?.id);
    expect(bundle.variables[0]).toMatchObject({ key: 'baseUrl', value: 'https://api.test' });
  });

  it('imports Postman features: url objects, inherited auth, bodies and ignored scripts', () => {
    const postman = {
      info: {
        name: 'P',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: {
        type: 'apikey',
        apikey: [
          { key: 'key', value: 'X-Key' },
          { key: 'value', value: '{{k}}' },
          { key: 'in', value: 'header' },
        ],
      },
      event: [{ listen: 'prerequest', script: { exec: ['console.log(1)'] } }],
      item: [
        {
          name: 'Form',
          request: {
            method: 'post',
            url: {
              protocol: 'https',
              host: ['api', 'test'],
              path: ['v1', 'form'],
              query: [{ key: 'a', value: '1' }],
            },
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'f', type: 'file', src: '/tmp/x.png' },
                { key: 't', value: 'v' },
              ],
            },
          },
        },
        {
          name: 'Weird',
          request: { method: 'PROPFIND', url: 'https://x.test', auth: { type: 'hawk' } },
        },
        { name: 'Raw', request: 'https://plain.test/' },
        {
          name: 'Enc',
          request: {
            method: 'PUT',
            url: 'https://x.test',
            body: { mode: 'urlencoded', urlencoded: [{ key: 'k', value: 'v', disabled: true }] },
          },
        },
      ],
    };
    const { bundle, warnings } = importCollection(JSON.stringify(postman));
    const [form, weird, raw, enc] = bundle.requests.map((r) => r.draft);
    expect(form).toMatchObject({
      method: 'POST',
      url: 'https://api.test/v1/form?a=1',
      auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: '{{k}}' },
      body: {
        mode: 'form-data',
        formData: [
          { key: 'f', type: 'file', value: 'x.png' },
          { key: 't', type: 'text', value: 'v' },
        ],
      },
    });
    expect(weird).toMatchObject({ method: 'GET', auth: { type: 'none' } });
    expect(raw?.url).toBe('https://plain.test/');
    expect(enc?.body.form[0]?.enabled).toBe(false);
    expect(warnings.join('\n')).toMatch(/never runs imported code/);
    expect(warnings.join('\n')).toMatch(/PROPFIND/);
    expect(warnings.join('\n')).toMatch(/"hawk"/);
    expect(warnings.join('\n')).toMatch(/choose them again/);
  });

  it('rejects malformed and unknown files', () => {
    expect(() => importCollection('{')).toThrow('not valid JSON');
    expect(() => importCollection('[]')).toThrow(/Unknown file/);
    expect(() =>
      importCollection(
        JSON.stringify({
          info: { schema: 'https://schema.getpostman.com/json/collection/v1.0.0/' },
        }),
      ),
    ).toThrow(/v2.0 and v2.1/);
    expect(() =>
      importCollection(JSON.stringify({ format: 'devstudio.api-collection', version: 2 })),
    ).toThrow(/not a valid DevStudio collection/);
  });

  it('repairs folder cycles, dangling folders and invalid requests in native files', () => {
    const text = JSON.stringify({
      format: 'devstudio.api-collection',
      version: 1,
      collection: {
        name: 'C',
        folders: [
          { id: 'a', name: 'A', parentId: 'b' },
          { id: 'b', name: 'B', parentId: 'a' },
          { id: 'c', name: 'C', parentId: 'zzz' },
        ],
      },
      requests: [
        { folderId: 'missing', request: { url: 'https://x.test' } },
        { folderId: null, request: { method: 'TRACE' } },
        { folderId: 'a', request: { url: 'https://y.test', __proto__: { polluted: true } } },
      ],
    });
    const { bundle, warnings } = importCollection(text);
    expect(bundle.folders.find((f) => f.id === 'c')?.parentId).toBeNull();
    expect(bundle.folders.some((f) => f.parentId === null && (f.id === 'a' || f.id === 'b'))).toBe(
      true,
    );
    expect(bundle.requests.map((r) => r.folderId)).toEqual([null, 'a']);
    expect(warnings).toEqual(['Request 2 is invalid and was skipped.']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('OAuth 2.0 helpers', () => {
  const config = {
    ...emptyRequest().auth.oauth2,
    grant: 'authorization_code' as const,
    authUrl: 'https://auth.test/authorize',
    tokenUrl: 'https://auth.test/token',
    clientId: 'my app',
    scope: 'read write',
  };

  it('creates RFC 7636 verifiers and S256 challenges', async () => {
    const { verifier, challenge } = await createPkce();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // RFC 7636 appendix B test vector.
    const bytes = new TextEncoder().encode('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    const fixed = await createPkce((buf) => buf);
    expect(fixed.verifier).toHaveLength(64);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    expect(
      btoa(String.fromCharCode(...digest))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(createState()).not.toBe(createState());
  });

  it('builds the authorization URL and token requests', () => {
    const url = new URL(authorizationUrl(config, 'https://app.test/oauth/callback', 'st', 'ch'));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'my app',
      redirect_uri: 'https://app.test/oauth/callback',
      scope: 'read write',
      state: 'st',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    });
    const code = tokenRequest(config, {
      type: 'authorization_code',
      code: 'c',
      verifier: 'v',
      redirectUri: 'r',
    });
    expect(Object.fromEntries(new URLSearchParams(code.body))).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      redirect_uri: 'r',
      code_verifier: 'v',
      client_id: 'my app',
    });
    const cc = tokenRequest(
      { ...config, grant: 'client_credentials', clientSecret: 's:é' },
      { type: 'client_credentials' },
    );
    expect(cc.headers).toContainEqual(['Authorization', `Basic ${btoa('my+app:s%3A%C3%A9')}`]);
    expect(cc.body).toBe('grant_type=client_credentials&scope=read+write');
  });

  it('validates the configuration', () => {
    expect(() => validateOAuthConfig({ ...config, clientId: '' })).toThrow('client ID');
    expect(() => validateOAuthConfig({ ...config, tokenUrl: 'http://auth.test/token' })).toThrow(
      /https/,
    );
    expect(() =>
      validateOAuthConfig({ ...config, tokenUrl: 'http://localhost:8080/token' }),
    ).not.toThrow();
    expect(() => validateOAuthConfig({ ...config, authUrl: 'nope' })).toThrow('authorization URL');
    expect(() => validateOAuthConfig({ ...config, grant: 'client_credentials' })).toThrow(
      'client secret',
    );
  });

  it('parses token responses, provider errors and callbacks', () => {
    expect(
      parseTokenResponse(200, '{"access_token":"t","token_type":"bearer","expires_in":3600}'),
    ).toEqual({
      accessToken: 't',
      tokenType: 'bearer',
      expiresIn: 3600,
      scope: null,
    });
    expect(() =>
      parseTokenResponse(400, '{"error":"invalid_client","error_description":"Bad secret"}'),
    ).toThrow('The provider refused the request (invalid_client: Bad secret).');
    expect(() => parseTokenResponse(200, '{}')).toThrow('no access_token');
    expect(() => parseTokenResponse(500, 'oops')).toThrow('without a JSON body');
    expect(parseCallback('?code=abc&state=xyz')).toEqual({
      code: 'abc',
      state: 'xyz',
      error: null,
    });
    expect(parseCallback('?error=access_denied&error_description=No').error).toBe(
      'access_denied: No',
    );
  });
});

describe('response comparison', () => {
  const side = (patch: Partial<ResponseSide> = {}): ResponseSide => ({
    status: 200,
    durationMs: 10,
    sizeBytes: 20,
    contentType: 'application/json',
    headers: [
      ['Content-Type', 'application/json'],
      ['Date', 'x'],
    ],
    body: '{"b":1,"a":[1,2]}',
    ...patch,
  });

  it('compares status, headers and JSON bodies structurally', () => {
    const c = compareResponses(
      side(),
      side({
        status: 201,
        headers: [
          ['content-type', 'application/json; charset=utf-8'],
          ['Date', 'y'],
          ['X-New', '1'],
        ],
        body: '{"a":[1,3],"c":true}',
      }),
    );
    expect(c.meta.filter((m) => m.different).map((m) => m.label)).toEqual(['Status']);
    expect(c.headers).toEqual([
      {
        name: 'content-type',
        left: 'application/json',
        right: 'application/json; charset=utf-8',
        kind: 'changed',
      },
      { name: 'x-new', left: null, right: '1', kind: 'added' },
    ]);
    expect(c.body.kind).toBe('json');
    if (c.body.kind !== 'json') return;
    expect(c.body.diff.summary).toMatchObject({ added: 1, removed: 1, changed: 1 });
    // Keys are sorted, so key order never shows up as a difference.
    expect(c.body.left).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}');
  });

  it('falls back to text for non-JSON bodies', () => {
    const c = compareResponses(side({ body: '<a/>' }), side({ body: '<a/>' }), {
      ignoreVolatileHeaders: false,
    });
    expect(c.body).toEqual({ kind: 'text', equal: true, left: '<a/>', right: '<a/>' });
    expect(c.headers.find((h) => h.name === 'date')?.kind).toBe('same');
    expect(compareResponses(side({ body: null }), side()).body.kind).toBe('text');
  });
});
