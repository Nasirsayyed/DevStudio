/**
 * Platform-aware hotkey parsing and matching.
 * Combo syntax: modifiers + key joined by "+", e.g. "mod+k", "mod+shift+l", "alt+1", "?".
 * "mod" means ⌘ on Apple platforms and Ctrl elsewhere.
 */
export interface HotkeyCombo {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export interface KeyEventLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function parseHotkey(combo: string): HotkeyCombo {
  const parts = combo.toLowerCase().split('+');
  // Support "+" as a key itself, e.g. "mod++"
  const key = combo.endsWith('++') ? '+' : (parts[parts.length - 1] ?? '');
  const mods = new Set(parts.slice(0, -1));
  return { key, mod: mods.has('mod'), shift: mods.has('shift'), alt: mods.has('alt') };
}

export function isApplePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Normalizes the pressed key; uses `code` for digits so Alt/Shift+digit works on all layouts. */
function eventKey(event: KeyEventLike): string {
  if (event.code && /^Digit\d$/.test(event.code)) return event.code.slice(5);
  return event.key.toLowerCase();
}

export function matchesHotkey(event: KeyEventLike, combo: HotkeyCombo, isApple: boolean): boolean {
  const modPressed = isApple ? event.metaKey : event.ctrlKey;
  const otherMod = isApple ? event.ctrlKey : event.metaKey;
  if (combo.mod !== modPressed || otherMod) return false;
  if (combo.alt !== event.altKey) return false;
  const key = eventKey(event);
  // Characters like "?" already imply Shift; don't require it to be declared.
  const shiftImplied = key.length === 1 && !/[a-z0-9]/.test(key);
  if (!shiftImplied && combo.shift !== event.shiftKey) return false;
  return key === combo.key;
}

/** Human-readable label, e.g. "⌘ K" or "Ctrl K". */
export function formatHotkey(combo: string, isApple: boolean): string[] {
  const parsed = parseHotkey(combo);
  const out: string[] = [];
  if (parsed.mod) out.push(isApple ? '⌘' : 'Ctrl');
  if (parsed.alt) out.push(isApple ? '⌥' : 'Alt');
  if (parsed.shift) out.push(isApple ? '⇧' : 'Shift');
  out.push(parsed.key.length === 1 ? parsed.key.toUpperCase() : capitalize(parsed.key));
  return out;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** True when focus is in a text-entry element where plain-key shortcuts must not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  // Not implemented by every DOM (e.g. jsdom), so it may be undefined at runtime.
  const contentEditable = el.isContentEditable as boolean | undefined;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || contentEditable === true;
}
