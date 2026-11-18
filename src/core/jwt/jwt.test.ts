import { SignJWT, exportJWK, exportSPKI, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { bytesToBase64 } from '../encoding/base64';
import { decodeJwt } from './decode';
import { verifyJwt } from './verify';

const secret = 'super-secret-key-for-tests-0123456789';
const bytes = (s: string) => new Uint8Array(Array.from(new TextEncoder().encode(s)));
const now = Math.floor(Date.now() / 1000);

let hsToken: string;
let rs: { token: string; pem: string; jwk: object };
let es: { token: string; pem: string };

beforeAll(async () => {
  hsToken = await new SignJWT({ sub: '42', name: 'Ada', roles: ['admin'] })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('https://issuer.example')
    .setAudience('api')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(bytes(secret));
  const rsa = await generateKeyPair('RS256', { extractable: true });
  rs = {
    token: await new SignJWT({ sub: 'rsa' })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setExpirationTime(now + 60)
      .sign(rsa.privateKey),
    pem: await exportSPKI(rsa.publicKey),
    jwk: { ...(await exportJWK(rsa.publicKey)), kid: 'key-1', alg: 'RS256' },
  };
  const ec = await generateKeyPair('ES256', { extractable: true });
  es = {
    token: await new SignJWT({ sub: 'ec' })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(ec.privateKey),
    pem: await exportSPKI(ec.publicKey),
  };
});

describe('decodeJwt', () => {
  it('decodes header, payload and timing without claiming verification', () => {
    const d = decodeJwt(`Bearer ${hsToken}`);
    expect(d.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(d.payload).toMatchObject({
      sub: '42',
      name: 'Ada',
      iss: 'https://issuer.example',
      aud: 'api',
    });
    expect(d.algorithm).toBe('HS256');
    expect(d.signatureBytes).toBe(32);
    expect(d.timing.status).toBe('valid');
    expect(d.timing.expiresAt?.getTime()).toBe((now + 3600) * 1000);
    expect(d.verified).toBe(false);
  });

  it('reports expiry and not-before status', () => {
    expect(decodeJwt(hsToken, (now + 7200) * 1000).timing.status).toBe('expired');
    const enc = (o: object) => bytesToBase64(new TextEncoder().encode(JSON.stringify(o)), true);
    expect(decodeJwt(`${enc({ alg: 'none' })}.${enc({ nbf: now + 100 })}.`).timing.status).toBe(
      'not-yet-valid',
    );
    expect(decodeJwt(`${enc({ alg: 'none' })}.${enc({ a: 1 })}.`).timing.status).toBe('no-expiry');
  });

  it.each([
    ['', 'Paste a JWT'],
    ['abc', 'A JWT has 3 parts separated by dots; this has 1.'],
    ['a.b.c.d.e', 'encrypted token (JWE'],
    ['%%%.e30.', 'header is not valid Base64URL'],
    ['e30.e30.', 'no "alg"'],
    ['WzFd.e30.', 'header must be a JSON object'],
    ['eyJhbGciOiJIUzI1NiJ9.bm90IGpzb24.', 'payload is not valid JSON'],
  ])('rejects malformed token %j', (token, message) => {
    expect(() => decodeJwt(token)).toThrow(ValidationError);
    expect(() => decodeJwt(token)).toThrow(message);
  });

  it('still decodes the header and payload when only the signature is malformed', () => {
    const d = decodeJwt('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.x');
    expect(d.payload).toEqual({ sub: 'x' });
    expect(d.signatureError).toMatch(/not valid Base64URL/);
    expect(decodeJwt(hsToken).signatureError).toBeNull();
  });
});

describe('verifyJwt', () => {
  it('verifies HMAC tokens with the right secret (utf8, base64, hex)', async () => {
    expect((await verifyJwt(hsToken, { kind: 'secret', secret, encoding: 'utf8' })).status).toBe(
      'verified',
    );
    expect(
      (await verifyJwt(hsToken, { kind: 'secret', secret: btoa(secret), encoding: 'base64' }))
        .status,
    ).toBe('verified');
    const hex = Array.from(new TextEncoder().encode(secret), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    expect(
      (await verifyJwt(hsToken, { kind: 'secret', secret: hex, encoding: 'hex' })).status,
    ).toBe('verified');
  });

  it('rejects a wrong secret and tampered payloads', async () => {
    expect(
      await verifyJwt(hsToken, { kind: 'secret', secret: 'wrong', encoding: 'utf8' }),
    ).toMatchObject({
      status: 'invalid-signature',
      reason: expect.stringContaining('does NOT match') as unknown,
    });
    const [h, , s] = hsToken.split('.');
    const forged = `${h}.${bytesToBase64(new TextEncoder().encode('{"sub":"1","admin":true}'), true)}.${s}`;
    expect((await verifyJwt(forged, { kind: 'secret', secret, encoding: 'utf8' })).status).toBe(
      'invalid-signature',
    );
  });

  it('verifies RSA with PEM, JWK and JWKS, and ECDSA with PEM', async () => {
    expect((await verifyJwt(rs.token, { kind: 'pem', pem: rs.pem })).status).toBe('verified');
    expect((await verifyJwt(rs.token, { kind: 'jwk', json: JSON.stringify(rs.jwk) })).status).toBe(
      'verified',
    );
    expect(
      (await verifyJwt(rs.token, { kind: 'jwk', json: JSON.stringify({ keys: [rs.jwk] }) })).status,
    ).toBe('verified');
    expect((await verifyJwt(es.token, { kind: 'pem', pem: es.pem })).status).toBe('verified');
    expect((await verifyJwt(es.token, { kind: 'pem', pem: rs.pem })).status).not.toBe('verified');
  });

  it('separates claim failures from signature failures', async () => {
    const expired = await verifyJwt(
      hsToken,
      { kind: 'secret', secret, encoding: 'utf8' },
      { currentDate: new Date((now + 7200) * 1000) },
    );
    expect(expired).toMatchObject({
      status: 'claims-invalid',
      reason: expect.stringContaining('expired') as unknown,
    });
    expect(
      await verifyJwt(
        hsToken,
        { kind: 'secret', secret, encoding: 'utf8' },
        { issuer: 'https://other' },
      ),
    ).toMatchObject({
      status: 'claims-invalid',
      reason: expect.stringContaining('issuer') as unknown,
    });
    expect(
      (
        await verifyJwt(
          hsToken,
          { kind: 'secret', secret, encoding: 'utf8' },
          { audience: 'api', issuer: 'https://issuer.example' },
        )
      ).status,
    ).toBe('verified');
  });

  it('refuses unsafe or mismatched keys and alg "none"', async () => {
    const none = `${bytesToBase64(new TextEncoder().encode('{"alg":"none"}'), true)}.${bytesToBase64(new TextEncoder().encode('{"admin":true}'), true)}.`;
    expect((await verifyJwt(none, { kind: 'secret', secret, encoding: 'utf8' })).status).toBe(
      'invalid-signature',
    );
    expect(await verifyJwt(hsToken, { kind: 'pem', pem: rs.pem })).toMatchObject({
      status: 'error',
      reason: expect.stringContaining('needs the shared secret') as unknown,
    });
    expect(await verifyJwt(rs.token, { kind: 'secret', secret, encoding: 'utf8' })).toMatchObject({
      status: 'error',
      reason: expect.stringContaining('needs a public key') as unknown,
    });
    expect(
      (
        await verifyJwt(rs.token, {
          kind: 'pem',
          pem: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----',
        })
      ).status,
    ).toBe('error');
    expect((await verifyJwt(rs.token, { kind: 'jwk', json: '{nope' })).status).toBe('error');
    expect(
      (
        await verifyJwt(rs.token, {
          kind: 'jwk',
          json: JSON.stringify({ keys: [{ ...rs.jwk, kid: 'other' }] }),
        })
      ).status,
    ).not.toBe('verified');
  });
});
