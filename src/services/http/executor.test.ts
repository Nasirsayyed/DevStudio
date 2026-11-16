import { describe, expect, it, vi } from 'vitest';
import { buildRequest } from '@/core/http/build';
import { emptyRequest } from '@/core/http/model';
import { isAbortError } from '@/services/workers/taskRunner';
import { classifyFailure, sendRequest } from './executor';

const get = (url = 'https://api.example.com/x') => buildRequest(emptyRequest({ url }), []);
let t = 0;
const clock = () => (t += 5);

describe('sendRequest', () => {
  it('returns status, headers, decoded text, size and timings', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response('{"ok":true}', {
          status: 201,
          statusText: 'Created',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Id': '7' },
        }),
      ),
    );
    const r = await sendRequest(get(), { fetchImpl, now: clock });
    expect(r).toMatchObject({
      status: 201,
      statusText: 'Created',
      text: '{"ok":true}',
      sizeBytes: 11,
      truncated: false,
      contentType: 'application/json; charset=utf-8',
    });
    expect(r.headers).toContainEqual(['x-id', '7']);
    expect(r.timings.totalMs).toBeGreaterThanOrEqual(r.timings.firstByteMs);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/x',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
      }),
    );
  });

  it('detects binary bodies, truncates large ones and decodes other charsets', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]);
    const bin = await sendRequest(get(), {
      fetchImpl: () =>
        Promise.resolve(new Response(png, { headers: { 'Content-Type': 'image/png' } })),
    });
    expect(bin.text).toBeNull();
    expect([...bin.bytes]).toEqual([...png]);
    const big = await sendRequest(get(), {
      maxBytes: 4,
      fetchImpl: () => Promise.resolve(new Response('abcdefgh')),
    });
    expect(big).toMatchObject({ truncated: true, sizeBytes: 4, text: 'abcd' });
    const latin = await sendRequest(get(), {
      fetchImpl: () =>
        Promise.resolve(
          new Response(new Uint8Array([0x63, 0x61, 0x66, 0xe9]), {
            headers: { 'Content-Type': 'text/plain; charset=iso-8859-1' },
          }),
        ),
    });
    expect(latin.text).toBe('café');
  });

  it('sends form data with chosen files and refuses missing files', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(init?.body instanceof FormData ? String([...init.body.keys()]) : 'no'),
      ),
    );
    const p = buildRequest(
      emptyRequest({
        method: 'POST',
        url: 'x.org',
        body: {
          ...emptyRequest().body,
          mode: 'form-data',
          formData: [{ id: 'f', key: 'doc', value: 'a.txt', type: 'file', enabled: true }],
        },
      }),
      [],
    );
    await expect(sendRequest(p, { fetchImpl })).rejects.toThrow(
      'Choose a file for the form field "doc".',
    );
    const r = await sendRequest(p, {
      fetchImpl,
      files: new Map([['f', new File(['hi'], 'a.txt')]]),
    });
    expect(r.text).toBe('doc');
  });

  it('classifies failures: CORS/network, mixed content, timeout and cancel', async () => {
    const failing = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(sendRequest(get(), { fetchImpl: failing })).rejects.toMatchObject({
      code: 'CORS',
    });
    expect(classifyFailure('http://api.example.com/x', 'https://devstudio.app').message).toMatch(
      /mixed content/,
    );
    expect(classifyFailure('http://localhost:3000/x', 'https://devstudio.app').code).toBe('CORS');
    expect(classifyFailure('https://devstudio.app/x', 'https://devstudio.app').message).toMatch(
      /unreachable/,
    );
    const hanging = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_r, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    await expect(sendRequest(get(), { fetchImpl: hanging, timeoutMs: 20 })).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: 'No response within 0 s.',
    });
    const controller = new AbortController();
    const pending = sendRequest(get(), { fetchImpl: hanging, signal: controller.signal });
    controller.abort();
    expect(isAbortError(await pending.catch((e: unknown) => e))).toBe(true);
  });
});
