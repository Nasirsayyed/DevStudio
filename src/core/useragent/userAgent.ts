import { UAParser } from 'ua-parser-js';

export interface ParsedUserAgent {
  browser: { name: string | null; version: string | null; major: string | null };
  engine: { name: string | null; version: string | null };
  os: { name: string | null; version: string | null };
  device: { type: string; vendor: string | null; model: string | null };
  cpu: string | null;
  bot: string | null;
  summary: string;
}

const BOTS: [RegExp, string][] = [
  [/googlebot/i, 'Googlebot'],
  [/bingbot/i, 'Bingbot'],
  [/duckduckbot/i, 'DuckDuckBot'],
  [/baiduspider/i, 'Baiduspider'],
  [/yandex(bot)?/i, 'YandexBot'],
  [/slurp/i, 'Yahoo Slurp'],
  [/facebookexternalhit|facebot/i, 'Facebook crawler'],
  [/twitterbot/i, 'Twitterbot'],
  [/linkedinbot/i, 'LinkedInBot'],
  [/gptbot|chatgpt-user/i, 'OpenAI crawler'],
  [/claudebot|claude-web/i, 'Anthropic crawler'],
  [/headlesschrome/i, 'Headless Chrome'],
  [/curl\//i, 'curl'],
  [/wget\//i, 'Wget'],
  [/postmanruntime/i, 'Postman'],
  [/python-requests|aiohttp|httpx/i, 'Python HTTP client'],
  [/\b(bot|crawler|spider|scraper)\b/i, 'Generic bot'],
];

/** Parses a User-Agent string (ua-parser-js 1.x, MIT) and flags known bots and tools. */
export function parseUserAgent(ua: string): ParsedUserAgent {
  const input = ua.trim();
  if (!input) {
    // UAParser treats "" as "not provided" and would parse the current browser instead.
    return {
      browser: { name: null, version: null, major: null },
      engine: { name: null, version: null },
      os: { name: null, version: null },
      device: { type: 'unknown', vendor: null, model: null },
      cpu: null,
      bot: null,
      summary: 'Unknown browser',
    };
  }
  const r = new UAParser(input).getResult();
  const bot = BOTS.find(([re]) => re.test(ua))?.[1] ?? null;
  const v = (x: string | undefined) => x ?? null;
  const parsed = {
    browser: {
      name: v(r.browser.name),
      version: v(r.browser.version),
      major: r.browser.version?.split('.')[0] ?? null,
    },
    engine: { name: v(r.engine.name), version: v(r.engine.version) },
    os: { name: v(r.os.name), version: v(r.os.version) },
    device: {
      type: r.device.type ?? (bot ? 'bot' : 'desktop'),
      vendor: v(r.device.vendor),
      model: v(r.device.model),
    },
    cpu: v(r.cpu.architecture),
    bot,
  };
  const browser = [parsed.browser.name, parsed.browser.major].filter(Boolean).join(' ');
  const os = [parsed.os.name, parsed.os.version].filter(Boolean).join(' ');
  const summary = bot
    ? `${bot}${browser ? ` (${browser})` : ''}`
    : [
        browser || 'Unknown browser',
        os && `on ${os}`,
        parsed.device.type !== 'desktop' ? `(${parsed.device.type})` : '',
      ]
        .filter(Boolean)
        .join(' ');
  return { ...parsed, summary };
}
