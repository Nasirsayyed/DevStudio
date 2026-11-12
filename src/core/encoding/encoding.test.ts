import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { bytesToBase64, decodeBase64, encodeBase64, hexDump, sniffBinaryType } from './base64';
import { decodeHtmlEntities, encodeHtmlEntities } from './html';
import { decodeUrl, encodeUrl, parseUrl } from './url';

describe('Base64', () => {
  it('encodes RFC 4648 vectors and Unicode', () => {
    expect(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'].map((s) => encodeBase64(s))).toEqual([
      '',
      'Zg==',
      'Zm8=',
      'Zm9v',
      'Zm9vYg==',
      'Zm9vYmE=',
      'Zm9vYmFy',
    ]);
    expect(encodeBase64('Hello, 世界 👋')).toBe('SGVsbG8sIOS4lueVjCDwn5GL');
    expect(decodeBase64('SGVsbG8sIOS4lueVjCDwn5GL').text).toBe('Hello, 世界 👋');
  });

  it('supports URL-safe output and line wrapping', () => {
    expect(bytesToBase64(new Uint8Array([0xfb, 0xff, 0xbf]), true)).toBe('-_-_');
    expect(
      encodeBase64('a'.repeat(100), { lineLength: 76 })
        .split('\n')
        .map((l) => l.length),
    ).toEqual([76, 60]);
  });

  it('decodes tolerantly: whitespace, URL-safe, missing padding, data URLs', () => {
    expect(decodeBase64('Zm9v\nYmFy').text).toBe('foobar');
    expect(decodeBase64('Zm9vYg').text).toBe('foob');
    expect(decodeBase64('-_-_')).toMatchObject({ urlSafe: true });
    expect(decodeBase64('data:text/plain;base64,aGk=').text).toBe('hi');
  });

  it('reports invalid input precisely and detects binary data', () => {
    expect(() => decodeBase64('Zm9v*YmFy')).toThrow('Invalid Base64 character "*" at position 5.');
    expect(() => decodeBase64('Zm=9v')).toThrow(/Padding/);
    expect(() => decodeBase64('Zm9vY')).toThrow(/truncated/);
    const png = decodeBase64('iVBORw0KGgo=');
    expect(png.text).toBeNull();
    expect(sniffBinaryType(png.bytes)).toEqual({ mime: 'image/png', extension: 'png' });
    expect(hexDump(png.bytes)).toBe(
      '00000000  89 50 4e 47 0d 0a 1a 0a                          .PNG....',
    );
  });
});

describe('URL encoding', () => {
  it('encodes per mode', () => {
    const s = "a b&c=d/é?(x)'!";
    expect(encodeUrl(s, 'component')).toBe('a%20b%26c%3Dd%2F%C3%A9%3F%28x%29%27%21');
    expect(encodeUrl(s, 'form')).toBe('a+b%26c%3Dd%2F%C3%A9%3F%28x%29%27%21');
    expect(encodeUrl('https://x.dev/a b?q=1&r=é', 'uri')).toBe('https://x.dev/a%20b?q=1&r=%C3%A9');
    expect(() => encodeUrl('\uD800', 'component')).toThrow(ValidationError);
  });

  it('decodes and reports malformed escapes', () => {
    expect(decodeUrl('a%20b+c', false)).toBe('a b+c');
    expect(decodeUrl('a%20b+c', true)).toBe('a b c');
    expect(() => decodeUrl('100%', false)).toThrow('Malformed percent-encoding "%" at position 4.');
    expect(() => decodeUrl('%E9', false)).toThrow(/not valid UTF-8/);
  });

  it('parses URLs into components and query parameters', () => {
    const u = parseUrl('https://user:secret@api.example.com:8443/v1/items?q=a%20b&tag=x&tag=y#top');
    expect(u).toMatchObject({
      protocol: 'https:',
      username: 'user',
      hasPassword: true,
      hostname: 'api.example.com',
      port: '8443',
      pathname: '/v1/items',
      hash: '#top',
    });
    expect(u.params).toEqual([
      { key: 'q', value: 'a b' },
      { key: 'tag', value: 'x' },
      { key: 'tag', value: 'y' },
    ]);
    expect(() => parseUrl('/relative/path')).toThrow(/absolute URL/);
  });
});

describe('HTML entities', () => {
  it('encodes in every mode', () => {
    const s = `<a href="x">Café & "quotes" 'single' €</a>`;
    expect(encodeHtmlEntities(s, 'minimal')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Café &amp; &quot;quotes&quot; &apos;single&apos; €&lt;/a&gt;',
    );
    expect(encodeHtmlEntities('Café €', 'non-ascii')).toBe('Caf&eacute; &euro;');
    expect(encodeHtmlEntities('é😀', 'numeric')).toBe('&#xE9;&#x1F600;');
    expect(encodeHtmlEntities('a.b', 'all-named')).toBe('a&period;b');
  });

  it('decodes named, decimal and hex references', () => {
    expect(decodeHtmlEntities('&lt;p&gt;Caf&eacute; &#169; &#x1F600; &amp;amp; &nbsp;')).toBe(
      '<p>Café © 😀 &amp;  ',
    );
  });
});
