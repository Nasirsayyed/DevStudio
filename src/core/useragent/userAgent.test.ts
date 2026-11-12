import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './userAgent';

describe('parseUserAgent', () => {
  it('parses desktop and mobile browsers', () => {
    const chrome = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );
    expect(chrome).toMatchObject({
      browser: { name: 'Chrome', major: '131' },
      engine: { name: 'Blink' },
      os: { name: 'Windows', version: '10' },
      device: { type: 'desktop' },
      cpu: 'amd64',
      bot: null,
    });
    expect(chrome.summary).toBe('Chrome 131 on Windows 10');
    const iphone = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    );
    expect(iphone).toMatchObject({
      browser: { name: 'Mobile Safari' },
      os: { name: 'iOS' },
      device: { type: 'mobile', vendor: 'Apple', model: 'iPhone' },
    });
  });

  it('flags bots and tools', () => {
    expect(
      parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toMatchObject({ bot: 'Googlebot', device: { type: 'bot' } });
    expect(parseUserAgent('curl/8.5.0').summary).toBe('curl');
    expect(parseUserAgent('PostmanRuntime/7.39.0').bot).toBe('Postman');
  });

  it('handles empty or garbage input', () => {
    expect(parseUserAgent('').summary).toBe('Unknown browser');
    expect(parseUserAgent('???').browser.name).toBeNull();
  });
});
