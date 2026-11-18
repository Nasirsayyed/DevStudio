import { isApplePlatform } from '@/core/keyboard/hotkeys';

/** `userAgentData` is Chromium-only; `platform` is deprecated and may be empty. */
interface NavigatorPlatformInfo {
  userAgentData?: { platform?: string };
  platform?: string;
  userAgent: string;
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return '';
  const nav = navigator as NavigatorPlatformInfo;
  return nav.userAgentData?.platform || nav.platform || nav.userAgent;
}

/** Detects Apple platforms once (⌘ vs Ctrl). */
export const IS_APPLE: boolean = isApplePlatform(detectPlatform());
