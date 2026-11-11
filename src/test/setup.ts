import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';

// Some suites (e.g. config/*.test.ts) run in the Node environment without a DOM.
const hasDom = typeof window !== 'undefined';

// Monaco cannot run in jsdom; component tests use accessible textarea doubles.
// Real Monaco is exercised by the Playwright suite.
vi.mock('@/components/code-editor/MonacoCodeEditor', () => import('./mocks/MockCodeEditor'));
vi.mock('@/components/code-editor/MonacoDiffEditor', async () => ({
  default: (await import('./mocks/MockCodeEditor')).MockDiffEditor,
}));

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

  // jsdom has no layout engine: every element measures 0×0, which makes
  // virtualized lists (TanStack Virtual reads clientWidth/clientHeight) render
  // nothing. Report a typical viewport-sized box instead.
  for (const [prop, value] of [
    ['clientWidth', 1024],
    ['clientHeight', 768],
    ['offsetWidth', 1024],
    ['offsetHeight', 768],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => value });
  }
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 768,
      right: 1024,
      width: 1024,
      height: 768,
      toJSON: () => ({}),
    };
  };

  // jsdom does not implement scrollIntoView.
  const elementProto = Element.prototype as Partial<Pick<Element, 'scrollIntoView'>>;
  elementProto.scrollIntoView ??= vi.fn();
}
