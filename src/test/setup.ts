import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';

// Some suites (e.g. config/*.test.ts) run in the Node environment without a DOM.
const hasDom = typeof window !== 'undefined';

if (hasDom) {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup, configure } = await import('@testing-library/react');
  // Lazy route/palette chunks are transformed on first use; give async queries headroom.
  configure({ asyncUtilTimeout: 4000 });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  // jsdom declares but does not implement matchMedia (used by MUI useMediaQuery).
  // Stub: desktop width (min-width queries match), light color scheme.
  if (typeof (window as Partial<Window>).matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  if (typeof (window as { ResizeObserver?: unknown }).ResizeObserver !== 'function') {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
  }

  // jsdom does not implement scrollIntoView.
  const elementProto = Element.prototype as Partial<Pick<Element, 'scrollIntoView'>>;
  elementProto.scrollIntoView ??= vi.fn();
}
