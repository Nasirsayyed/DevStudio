import { describe, expect, it, vi } from 'vitest';
import { ParseError } from '@/core/errors/AppError';
import { type TaskRequest, handleTaskRequest } from '@/core/tasks/protocol';
import { createTaskRunner, isAbortError } from './taskRunner';

const ops = {
  double: (p: { n: number }) => p.n * 2,
  fail: (_: { n: number }) => {
    throw new ParseError('bad', { line: 2, column: 3 });
  },
};

/** In-memory Worker double that runs the real protocol handler asynchronously. */
class FakeWorker extends EventTarget {
  static created = 0;
  static terminated = 0;
  delay: number;
  constructor(delay = 5) {
    super();
    this.delay = delay;
    FakeWorker.created += 1;
  }
  postMessage(data: TaskRequest) {
    setTimeout(() => {
      this.dispatchEvent(new MessageEvent('message', { data: handleTaskRequest(ops, data) }));
    }, this.delay);
  }
  terminate() {
    FakeWorker.terminated += 1;
  }
}

class BrokenWorker extends EventTarget {
  postMessage() {
    setTimeout(() => {
      const event = new ErrorEvent('error', { message: 'blocked', cancelable: true });
      this.dispatchEvent(event);
    }, 1);
  }
  terminate() {}
}

describe('createTaskRunner', () => {
  it('runs small inputs on the main thread', async () => {
    const create = vi.fn(() => new FakeWorker() as unknown as Worker);
    vi.stubGlobal('Worker', FakeWorker);
    const runner = createTaskRunner({ ops, createWorker: create, workerThreshold: 100 });
    await expect(runner.run('double', { n: 2 }, { size: 10 })).resolves.toBe(4);
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('runs large inputs in a worker and reuses idle workers', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.created = 0;
    const runner = createTaskRunner({
      ops,
      createWorker: () => new FakeWorker() as unknown as Worker,
      workerThreshold: 100,
      maxWorkers: 2,
    });
    await expect(runner.run('double', { n: 5 }, { size: 1000 })).resolves.toBe(10);
    await expect(runner.run('double', { n: 6 }, { size: 1000 })).resolves.toBe(12);
    expect(FakeWorker.created).toBe(1);
    // Concurrent tasks use up to maxWorkers and queue the rest.
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) => runner.run('double', { n }, { size: 1000 })),
    );
    expect(results).toEqual([2, 4, 6, 8]);
    expect(FakeWorker.created).toBe(2);
    runner.dispose();
    vi.unstubAllGlobals();
  });

  it('rebuilds typed errors from the worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const runner = createTaskRunner({
      ops,
      createWorker: () => new FakeWorker() as unknown as Worker,
      workerThreshold: 0,
    });
    const error = await runner.run('fail', { n: 1 }, { size: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ParseError);
    expect((error as ParseError).line).toBe(2);
    vi.unstubAllGlobals();
  });

  it('cancels a running task by terminating only its worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.terminated = 0;
    const runner = createTaskRunner({
      ops,
      createWorker: () => new FakeWorker(50) as unknown as Worker,
      workerThreshold: 0,
    });
    const controller = new AbortController();
    const pending = runner.run('double', { n: 1 }, { size: 1, signal: controller.signal });
    setTimeout(() => {
      controller.abort();
    }, 5);
    const error = await pending.catch((e: unknown) => e);
    expect(isAbortError(error)).toBe(true);
    expect(FakeWorker.terminated).toBe(1);
    // The runner still works afterwards.
    await expect(runner.run('double', { n: 4 }, { size: 1 })).resolves.toBe(8);
    vi.unstubAllGlobals();
  });

  it('rejects immediately when already aborted', async () => {
    const runner = createTaskRunner({ ops, workerThreshold: 0 });
    const controller = new AbortController();
    controller.abort();
    expect(
      isAbortError(
        await runner
          .run('double', { n: 1 }, { signal: controller.signal })
          .catch((e: unknown) => e),
      ),
    ).toBe(true);
  });

  it('falls back to the main thread when the worker cannot start', async () => {
    vi.stubGlobal('Worker', BrokenWorker);
    const create = vi.fn(() => new BrokenWorker() as unknown as Worker);
    const runner = createTaskRunner({ ops, createWorker: create, workerThreshold: 0 });
    await expect(runner.run('double', { n: 21 }, { size: 1 })).resolves.toBe(42);
    // Subsequent tasks skip the broken worker path entirely.
    await expect(runner.run('double', { n: 1 }, { size: 1 })).resolves.toBe(2);
    expect(create).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('runs on the main thread when Worker is unavailable (jsdom)', async () => {
    const runner = createTaskRunner({
      ops,
      createWorker: () => new FakeWorker() as unknown as Worker,
      workerThreshold: 0,
    });
    await expect(runner.run('double', { n: 3 }, { size: 10 })).resolves.toBe(6);
  });
});
