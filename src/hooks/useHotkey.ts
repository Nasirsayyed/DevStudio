import { useEffect, useRef } from 'react';
import { isEditableTarget, matchesHotkey, parseHotkey } from '@/core/keyboard/hotkeys';
import { IS_APPLE } from './usePlatform';

export interface UseHotkeyOptions {
  /** Fire even when focus is inside an input/textarea/editor. Default: true if the combo has a modifier. */
  allowInInputs?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Registers a global keyboard shortcut. The handler is kept in a ref so callers
 * don't need to memoize it.
 */
export function useHotkey(
  combo: string | readonly string[],
  handler: (event: KeyboardEvent) => void,
  options: UseHotkeyOptions = {},
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const { enabled = true, preventDefault = true } = options;
  const combos = (typeof combo === 'string' ? [combo] : combo).join('|');

  useEffect(() => {
    if (!enabled) return undefined;
    const parsed = combos.split('|').map(parseHotkey);
    const onKeyDown = (event: KeyboardEvent) => {
      for (const c of parsed) {
        if (!matchesHotkey(event, c, IS_APPLE)) continue;
        const allowInInputs = options.allowInInputs ?? (c.mod || c.alt);
        if (!allowInInputs && isEditableTarget(event.target)) return;
        if (preventDefault) event.preventDefault();
        handlerRef.current(event);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [combos, enabled, preventDefault, options.allowInInputs]);
}
