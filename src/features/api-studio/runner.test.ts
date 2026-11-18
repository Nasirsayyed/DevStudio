import { describe, expect, it, vi } from 'vitest';
import { emptyRequest, rowId } from '@/core/http/model';
import type { HttpResponseSnapshot, sendRequest } from '@/services/http/executor';
import { type RunResult, runCollection, runReport } from './runner';

const response = (status: number, text: string): HttpResponseSnapshot => ({
  status,
  statusText: '',
  url: 'https://api.test',
  redirected: false,
  headers: [['content-type', 'application/json']],
  contentType: 'application/json',
  text,
  bytes: new Uint8Array(),
  sizeBytes: text.length,
  truncated: false,
  timings: { totalMs: 3, firstByteMs: 1 },
});

const item = (name: string, url: string, patch = {}) => ({
  id: name,
  draft: emptyRequest({ name, url, ...patch }),
});

function options(
  send: typeof sendRequest,
  patch: Partial<Parameters<typeof runCollection>[0]> = {},
) {
  const results: RunResult[] = [];
  return {
    results,
    o: {
      items: [item('a', 'https://api.test/a'), item('b', 'https://api.test/b?k={{key}}')],
      scopes: [new Map([['key', 'secret-value']])],
      secrets: ['secret-value'],
      iterations: 1,
      delayMs: 0,
      stopOnFailure: false,
      signal: new AbortController().signal,
      onResult: (r: RunResult) => results.push(r),
      send,
      ...patch,
    },
  };
}

describe('runCollection', () => {
  it('masks secret values in reported URLs, errors and reports', async () => {
    const send = vi
      .fn<typeof sendRequest>()
      .mockResolvedValueOnce(response(200, '{}'))
      .mockRejectedValueOnce(new Error('boom secret-value'));
    const { o, results } = options(send);
    await expect(runCollection(o)).resolves.toMatchObject({ stopped: 'completed' });
    expect(send.mock.calls[1]?.[0].url).toBe('https://api.test/b?k=secret-value');
    expect(results[1]).toMatchObject({
      passed: false,
      url: 'https://api.test/b?k=••••••',
      error: 'boom ••••••',
    });
    expect(runReport('C', results, o.secrets, new Date(0))).not.toContain('secret-value');
  });

  it('reports build errors (e.g. an undefined host variable) and keeps going', async () => {
    const send = vi.fn<typeof sendRequest>().mockResolvedValue(response(200, '{}'));
    const { o, results } = options(send, {
      items: [item('bad', 'https://{{host}}/x'), item('a', 'https://api.test/a')],
    });
    await runCollection(o);
    expect(results.map((r) => r.passed)).toEqual([false, true]);
    expect(results[0]?.error).toMatch(/host/i);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('waits between requests and can be cancelled during the delay', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const send = vi.fn<typeof sendRequest>().mockResolvedValue(response(200, '{}'));
      const { o, results } = options(send, {
        delayMs: 1000,
        iterations: 2,
        signal: controller.signal,
      });
      const run = runCollection(o);
      await vi.advanceTimersByTimeAsync(0);
      expect(results).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(results).toHaveLength(2);
      controller.abort();
      await expect(run).resolves.toMatchObject({ stopped: 'cancelled' });
      expect(send).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('chains extracted values across iterations and stops on failure', async () => {
    const send = vi
      .fn<typeof sendRequest>()
      .mockResolvedValueOnce(response(200, '{"next":"n1"}'))
      .mockResolvedValueOnce(response(500, '{}'));
    const extract = [
      { id: rowId(), variable: 'next', source: 'json' as const, path: '$.next', enabled: true },
    ];
    const assertions = [
      { id: rowId(), kind: 'status-in-range' as const, target: '', expected: '2xx', enabled: true },
    ];
    const { o, results } = options(send, {
      items: [
        item('first', 'https://api.test/1', { extract, assertions }),
        item('second', 'https://api.test/{{next}}', { assertions }),
        item('never', 'https://api.test/3'),
      ],
      stopOnFailure: true,
      runtime: { seeded: 'yes' },
    });
    const summary = await runCollection(o);
    expect(summary).toEqual({ stopped: 'failure', runtime: { seeded: 'yes', next: 'n1' } });
    expect(send.mock.calls[1]?.[0].url).toBe('https://api.test/n1');
    expect(results.map((r) => r.name)).toEqual(['first', 'second']);
  });
});
