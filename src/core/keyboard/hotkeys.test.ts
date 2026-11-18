import { describe, expect, it } from 'vitest';
import {
  formatHotkey,
  isApplePlatform,
  isEditableTarget,
  matchesHotkey,
  parseHotkey,
} from './hotkeys';

const ev = (
  key: string,
  mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {},
  code?: string,
) => ({
  key,
  ...(code ? { code } : {}),
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('parseHotkey', () => {
  it('parses modifiers and key', () => {
    expect(parseHotkey('mod+shift+L')).toEqual({ key: 'l', mod: true, shift: true, alt: false });
    expect(parseHotkey('alt+1')).toEqual({ key: '1', mod: false, shift: false, alt: true });
    expect(parseHotkey('?')).toEqual({ key: '?', mod: false, shift: false, alt: false });
    expect(parseHotkey('mod++').key).toBe('+');
  });
});

describe('matchesHotkey', () => {
  const modK = parseHotkey('mod+k');

  it('uses Ctrl on non-Apple and ⌘ on Apple platforms', () => {
    expect(matchesHotkey(ev('k', { ctrlKey: true }), modK, false)).toBe(true);
    expect(matchesHotkey(ev('k', { metaKey: true }), modK, false)).toBe(false);
    expect(matchesHotkey(ev('k', { metaKey: true }), modK, true)).toBe(true);
    expect(matchesHotkey(ev('k', { ctrlKey: true }), modK, true)).toBe(false);
  });

  it('requires exact modifiers', () => {
    expect(matchesHotkey(ev('k', { ctrlKey: true, shiftKey: true }), modK, false)).toBe(false);
    expect(matchesHotkey(ev('k', { ctrlKey: true, altKey: true }), modK, false)).toBe(false);
    expect(matchesHotkey(ev('k'), modK, false)).toBe(false);
  });

  it('matches uppercase keys produced with shift', () => {
    expect(
      matchesHotkey(ev('L', { ctrlKey: true, shiftKey: true }), parseHotkey('mod+shift+l'), false),
    ).toBe(true);
  });

  it('does not require shift to be declared for symbol keys like "?"', () => {
    expect(matchesHotkey(ev('?', { shiftKey: true }), parseHotkey('?'), false)).toBe(true);
  });

  it('uses the physical digit code so Alt+digit works on any layout', () => {
    // macOS Option+1 produces "¡" as key.
    expect(matchesHotkey(ev('¡', { altKey: true }, 'Digit1'), parseHotkey('alt+1'), true)).toBe(
      true,
    );
    expect(matchesHotkey(ev('2', { altKey: true }, 'Digit2'), parseHotkey('alt+1'), false)).toBe(
      false,
    );
  });
});

describe('formatHotkey', () => {
  it('formats per platform', () => {
    expect(formatHotkey('mod+shift+l', false)).toEqual(['Ctrl', 'Shift', 'L']);
    expect(formatHotkey('mod+k', true)).toEqual(['⌘', 'K']);
    expect(formatHotkey('alt+1', true)).toEqual(['⌥', '1']);
    expect(formatHotkey('enter', false)).toEqual(['Enter']);
  });
});

describe('platform and target helpers', () => {
  it('detects Apple platforms', () => {
    expect(isApplePlatform('MacIntel')).toBe(true);
    expect(isApplePlatform('iPhone')).toBe(true);
    expect(isApplePlatform('Win32')).toBe(false);
    expect(isApplePlatform('Linux x86_64')).toBe(false);
  });

  it('detects editable targets', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    const div = document.createElement('div');
    expect(isEditableTarget(div)).toBe(false);
    div.contentEditable = 'true';
    // jsdom does not compute isContentEditable; emulate a real browser.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isEditableTarget(div)).toBe(true);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});
