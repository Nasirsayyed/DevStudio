import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { buildRequest, withScheme } from './build';
import { parseCurl, shellWords, toCurl } from './curl';
import { interpolate, variablesIn } from './interpolate';
import {
  emptyRequest,
  hasLiteralCredentials,
  parseRequestDraft,
  type RequestDraft,
  rowId,
  withoutCredentials,
} from './model';
import { maskValues, redactHeaders, redactUrl, REDACTED } from './redact';
import { requestSnippet } from './snippets';

const kv = (key: string, value: string, enabled = true) => ({ id: rowId(), key, value, enabled });
const env = new Map([
  ['base', 'https://api.example.com'],
  ['token', 'abc'],
  ['id', '42'],
]);
const zero = (b: Uint8Array<ArrayBuffer>) => b.fill(0);

describe('interpolation', () => {
  it('resolves scopes in order, dynamic variables and reports missing ones', () => {
    const runtime = new Map([['id', '7']]);
    const r = interpolate('{{base}}/users/{{ id }}?t={{$timestamp}}&x={{nope}}', [runtime, env], {
      now: 1_700_000_000_123,
    });
    expect(r.text).toBe('https://api.example.com/users/7?t=1700000000&x={{nope}}');
    expect(r.missing).toEqual(['nope']);
    expect(r.used.sort()).toEqual(['$timestamp', 'base', 'id']);
    expect(interpolate('{{$isoTimestamp}}', [], { now: 0 }).text).toBe('1970-01-01T00:00:00.000Z');
    expect(interpolate('{{$guid}}', [], { random: zero }).text).toBe(
      '00000000-0000-4000-8000-000000000000',
    );
    expect(interpolate('{{$randomInt}}', [], { random: zero }).text).toBe('0');
    expect(variablesIn('{{a}} {{ b }} {{a}} {{$guid}}')).toEqual(['a', 'b', '$guid']);
  });
});

describe('buildRequest', () => {
  const req = (patch: Partial<RequestDraft>) => emptyRequest({ url: '{{base}}/items', ...patch });

  it('builds URL, params, headers and auth', () => {
    const p = buildRequest(
      req({
        params: [kv('q', 'a b'), kv('off', 'x', false), kv('id', '{{id}}')],
        headers: [kv('Accept', 'application/json'), kv('', 'ignored')],
        auth: { ...emptyRequest().auth, type: 'bearer', token: '{{token}}' },
      }),
      [env],
    );
    expect(p.url).toBe('https://api.example.com/items?q=a+b&id=42');
    expect(p.headers).toEqual([
      ['Accept', 'application/json'],
      ['Authorization', 'Bearer abc'],
    ]);
    expect(p.warnings).toEqual([]);
    const basic = buildRequest(
      req({ auth: { ...emptyRequest().auth, type: 'basic', username: 'ü', password: 'p:w' } }),
      [env],
    );
    expect(basic.headers).toEqual([
      ['Authorization', `Basic ${Buffer.from('ü:p:w', 'utf8').toString('base64')}`],
    ]);
    const key = buildRequest(
      req({
        auth: {
          ...emptyRequest().auth,
          type: 'apikey',
          apiKeyName: 'api_key',
          apiKeyValue: 's',
          apiKeyIn: 'query',
        },
      }),
      [env],
    );
    expect(key.url).toBe('https://api.example.com/items?api_key=s');
    const own = buildRequest(
      req({
        headers: [kv('authorization', 'Custom x')],
        auth: { ...emptyRequest().auth, type: 'bearer', token: 't' },
      }),
      [env],
    );
    expect(own.headers).toEqual([['authorization', 'Custom x']]);
  });

  it('builds every body mode with a sensible Content-Type', () => {
    const post = (body: Partial<RequestDraft['body']>, headers: RequestDraft['headers'] = []) =>
      buildRequest(req({ method: 'POST', headers, body: { ...emptyRequest().body, ...body } }), [
        env,
      ]);
    expect(post({ mode: 'json', raw: '{"id": {{id}}}' })).toMatchObject({
      body: { kind: 'text', text: '{"id": 42}' },
      headers: [['Content-Type', 'application/json']],
    });
    expect(post({ mode: 'json', raw: '{bad' }).warnings).toEqual(['The body is not valid JSON.']);
    expect(post({ mode: 'form-urlencoded', form: [kv('a', '1 2'), kv('b', '&')] }).body).toEqual({
      kind: 'text',
      text: 'a=1+2&b=%26',
    });
    expect(post({ mode: 'xml', raw: '<a/>' }, [kv('Content-Type', 'text/xml')]).headers).toEqual([
      ['Content-Type', 'text/xml'],
    ]);
    const form = post(
      {
        mode: 'form-data',
        formData: [
          { id: 'f1', key: 'file', value: 'a.png', type: 'file', enabled: true },
          { id: 'f2', key: 'n', value: '{{id}}', type: 'text', enabled: true },
        ],
      },
      [kv('Content-Type', 'multipart/form-data')],
    );
    expect(form.body).toEqual({
      kind: 'form-data',
      fields: [
        { key: 'file', value: 'a.png', fileEntryId: 'f1' },
        { key: 'n', value: '42', fileEntryId: null },
      ],
    });
    expect(form.headers).toEqual([]);
    expect(form.warnings[0]).toMatch(/boundary/);
    expect(
      post({ mode: 'graphql', graphql: { query: '{ me { id } }', variables: '{"a": 1}' } }).body,
    ).toEqual({ kind: 'text', text: '{"query":"{ me { id } }","variables":{"a":1}}' });
    expect(() => post({ mode: 'graphql', graphql: { query: 'q', variables: '{' } })).toThrow(
      /GraphQL variables/,
    );
  });

  it('rejects invalid URLs, schemes, headers and GET bodies, and warns about forbidden headers', () => {
    expect(() => buildRequest(emptyRequest({ url: '' }), [])).toThrow('Enter a URL.');
    expect(() => buildRequest(emptyRequest({ url: 'ht tp://x' }), [])).toThrow(ValidationError);
    expect(() => buildRequest(emptyRequest({ url: '{{missing}}/x' }), [])).toThrow(/missing/);
    expect(() => buildRequest(emptyRequest({ url: 'ftp://x.org' }), [])).toThrow(
      /Only http and https/,
    );
    expect(() =>
      buildRequest(emptyRequest({ url: ['javascript', 'alert(1)'].join(':') }), []),
    ).toThrow(ValidationError);
    expect(() =>
      buildRequest(emptyRequest({ url: 'x.org', headers: [kv('Bad Name', 'v')] }), []),
    ).toThrow(/not a valid header name/);
    expect(() =>
      buildRequest(emptyRequest({ url: 'x.org', headers: [kv('X', 'a\r\nInjected: 1')] }), []),
    ).toThrow(/line break/);
    expect(() =>
      buildRequest(
        emptyRequest({ url: 'x.org', body: { ...emptyRequest().body, mode: 'json', raw: '{}' } }),
        [],
      ),
    ).toThrow(/cannot have a body/);
    const p = buildRequest(
      emptyRequest({
        url: 'x.org/{{nope}}',
        headers: [kv('Cookie', 'a=1'), kv('Sec-Fetch-Mode', 'x')],
      }),
      [],
    );
    expect(p.headers).toEqual([]);
    expect(p.warnings).toEqual([
      'No value for {{nope}}.',
      'Browsers do not let pages set the "Cookie" header; it is not sent.',
      'Browsers do not let pages set the "Sec-Fetch-Mode" header; it is not sent.',
    ]);
    expect(withScheme('localhost:3000/a')).toBe('http://localhost:3000/a');
    expect(withScheme('example.com')).toBe('https://example.com');
  });
});

describe('cURL', () => {
  it('splits shell words with quotes, escapes and continuations', () => {
    expect(shellWords(`curl -H 'A: b c' "x\\"y" a\\ b \\\n --data '{"k":1}'`)).toEqual([
      'curl',
      '-H',
      'A: b c',
      'x"y',
      'a b',
      '--data',
      '{"k":1}',
    ]);
    expect(() => shellWords("curl 'open")).toThrow('unclosed quote');
  });

  it('imports common curl commands', () => {
    const json = parseCurl(
      `curl 'https://api.x.com/users?page=2&q=a%20b' -H 'Content-Type: application/json' -H "Authorization: Bearer t" --data-raw '{"name":"Ann"}' --compressed -k`,
    );
    expect(json.request).toMatchObject({
      method: 'POST',
      url: 'https://api.x.com/users',
      body: { mode: 'json', raw: '{"name":"Ann"}' },
    });
    expect(json.request.params.map((p) => [p.key, p.value])).toEqual([
      ['page', '2'],
      ['q', 'a b'],
    ]);
    expect(json.request.headers.map((h) => h.key)).toEqual(['Content-Type', 'Authorization']);
    expect(json.notes).toEqual([
      'Browsers always verify certificates; "--insecure" has no effect.',
    ]);
    const form = parseCurl('curl -X PUT https://x.org/a -d a=1 -d b=two -u user:pa:ss');
    expect(form.request).toMatchObject({
      method: 'PUT',
      body: { mode: 'form-urlencoded' },
      auth: { type: 'basic', username: 'user', password: 'pa:ss' },
    });
    expect(form.request.body.form.map((f) => [f.key, f.value])).toEqual([
      ['a', '1'],
      ['b', 'two'],
    ]);
    expect(parseCurl('curl -I https://x.org').request.method).toBe('HEAD');
    expect(parseCurl('curl -G https://x.org -d q=1').request).toMatchObject({
      method: 'GET',
      url: 'https://x.org',
    });
    const multipart = parseCurl('curl https://x.org -F name=Ann -F avatar=@me.png');
    expect(multipart.request.body.formData.map((f) => [f.key, f.type, f.value])).toEqual([
      ['name', 'text', 'Ann'],
      ['avatar', 'file', 'me.png'],
    ]);
    expect(
      parseCurl('curl --json \'{"a":1}\' https://x.org').request.headers.map((h) => [
        h.key,
        h.value,
      ]),
    ).toEqual([['Content-Type', 'application/json']]);
    expect(() => parseCurl('wget x')).toThrow(/starts with "curl"/);
    expect(() => parseCurl('curl -X')).toThrow(/needs a value/);
    expect(() => parseCurl('curl -X BREW https://x.org')).toThrow(/BREW/);
  });

  it('round-trips through toCurl and generates code snippets', () => {
    const p = buildRequest(
      emptyRequest({
        method: 'POST',
        url: "https://x.org/a?q=it's",
        headers: [kv('X-A', "o'k")],
        body: { ...emptyRequest().body, mode: 'json', raw: '{"a":"b\'c"}' },
      }),
      [],
    );
    const curl = toCurl(p);
    expect(curl).toBe(
      `curl -X POST 'https://x.org/a?q=it%27s' \\\n  -H 'X-A: o'\\''k' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{"a":"b'\\''c"}'`,
    );
    const back = parseCurl(curl).request;
    expect(back).toMatchObject({ method: 'POST', body: { mode: 'json', raw: '{"a":"b\'c"}' } });
    expect(requestSnippet(p, 'fetch')).toContain('body: "{\\"a\\":\\"b\'c\\"}",');
    expect(requestSnippet(p, 'python')).toContain(
      'response = requests.request("POST", "https://x.org/a?q=it%27s", headers=headers, data=data.encode("utf-8"))',
    );
    expect(requestSnippet(p, 'csharp')).toContain(
      'request.Content.Headers.TryAddWithoutValidation("Content-Type", "application/json");',
    );
  });
});

describe('credentials and redaction', () => {
  it('detects and strips literal credentials but keeps {{variables}}', () => {
    const d = emptyRequest({ auth: { ...emptyRequest().auth, type: 'bearer', token: 'secret' } });
    expect(hasLiteralCredentials(d.auth)).toBe(true);
    expect(withoutCredentials(d).auth.token).toBe('');
    const v = emptyRequest({
      auth: { ...emptyRequest().auth, type: 'bearer', token: '{{token}}' },
    });
    expect(hasLiteralCredentials(v.auth)).toBe(false);
    expect(withoutCredentials(v).auth.token).toBe('{{token}}');
    expect(hasLiteralCredentials(emptyRequest().auth)).toBe(false);
  });

  it('redacts sensitive headers and query parameters', () => {
    expect(
      redactHeaders(
        [
          ['Authorization', 'Bearer x'],
          ['Accept', '*/*'],
          ['X-Custom', 'k'],
        ],
        ['x-custom'],
      ),
    ).toEqual([
      ['Authorization', REDACTED],
      ['Accept', '*/*'],
      ['X-Custom', REDACTED],
    ]);
    expect(redactUrl('https://u:p@x.org/a?api_key=1&page=2&access_token=3')).toBe(
      `https://x.org/a?api_key=${encodeURIComponent(REDACTED)}&page=2&access_token=${encodeURIComponent(REDACTED)}`,
    );
    expect(redactUrl('https://x.org/a?page=2')).toBe('https://x.org/a?page=2');
    expect(redactUrl('not a url')).toBe('not a url');
    expect(maskValues('{"password":"hunter22","pin":"abc"}', ['hunter22', 'abc', 'hunter'])).toBe(
      `{"password":"${REDACTED}","pin":"abc"}`,
    );
  });

  it('reads stored requests with defaults for missing fields', () => {
    const d = parseRequestDraft({
      name: 'Old',
      method: 'GET',
      url: 'x',
      params: [],
      headers: [],
      body: { mode: 'json', raw: '{}' },
    });
    expect(d.body.graphql).toEqual({ query: '', variables: '' });
    expect(d.settings.timeoutMs).toBe(30_000);
    expect(() => parseRequestDraft({ method: 'BREW' })).toThrow();
  });
});
