import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePersistentOptions } from './usePersistentOptions';

const KEY = 'devstudio:options:test.tool';

describe('usePersistentOptions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses defaults, persists updates and restores them', () => {
    const { result, unmount } = renderHook(() =>
      usePersistentOptions('test.tool', { indent: 2, sort: false }),
    );
    expect(result.current[0]).toEqual({ indent: 2, sort: false });
    act(() => {
      result.current[1]({ sort: true });
    });
    expect(result.current[0]).toEqual({ indent: 2, sort: true });
    unmount();
    const again = renderHook(() => usePersistentOptions('test.tool', { indent: 2, sort: false }));
    expect(again.result.current[0]).toEqual({ indent: 2, sort: true });
  });

  it('ignores unknown keys, wrong types, corrupted JSON and pollution payloads', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ indent: 'four', sort: true, extra: 1 }));
    const { result } = renderHook(() =>
      usePersistentOptions('test.tool', { indent: 2, sort: false }),
    );
    expect(result.current[0]).toEqual({ indent: 2, sort: true });

    window.localStorage.setItem(KEY, '{not json');
    expect(
      renderHook(() => usePersistentOptions('test.tool', { indent: 2 })).result.current[0],
    ).toEqual({ indent: 2 });

    window.localStorage.setItem(KEY, '{"__proto__": {"polluted": true}, "indent": 4}');
    expect(
      renderHook(() => usePersistentOptions('test.tool', { indent: 2 })).result.current[0],
    ).toEqual({ indent: 4 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    window.localStorage.setItem(KEY, '[1,2]');
    expect(
      renderHook(() => usePersistentOptions('test.tool', { indent: 2 })).result.current[0],
    ).toEqual({ indent: 2 });
  });
});
