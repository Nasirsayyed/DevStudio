import { describe, expect, it } from 'vitest';
import { createMultiHasher, digestsEqual, hashText } from './hash';

describe('hashText — standard test vectors', () => {
  it.each([
    ['MD5', '900150983cd24fb0d6963f7d28e17f72'],
    ['SHA-1', 'a9993e364706816aba3e25717850c26c9cd0d89d'],
    ['SHA-224', '23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7'],
    ['SHA-256', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'SHA-384',
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    ],
    [
      'SHA-512',
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    ],
    ['RIPEMD-160', '8eb208f7e05d987a9b044a8e98c6b087f15a0bfc'],
  ] as const)('%s("abc")', (alg, expected) => {
    expect(hashText('abc', [alg])[alg]).toBe(expected);
  });

  it('labels crypto-js "SHA3" honestly as Keccak (Ethereum), not FIPS SHA3', () => {
    const r = hashText('', ['Keccak-256']);
    expect(r['Keccak-256']).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
    expect(r['Keccak-256']).not.toBe(
      'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a',
    );
  });

  it('hashes UTF-8 and supports base64 / uppercase output', () => {
    expect(hashText('é', ['SHA-256'])['SHA-256']).toBe(hashText('é', ['SHA-256'])['SHA-256']);
    expect(hashText('abc', ['MD5'], { encoding: 'base64' }).MD5).toBe('kAFQmDzST7DWlj99KOF/cg==');
    expect(hashText('abc', ['MD5'], { encoding: 'HEX' }).MD5).toBe(
      '900150983CD24FB0D6963F7D28E17F72',
    );
  });

  it('computes HMAC (RFC 4231-style vector) and skips Keccak for HMAC', () => {
    const r = hashText(
      'The quick brown fox jumps over the lazy dog',
      ['SHA-256', 'MD5', 'Keccak-256'],
      { hmacKey: 'key' },
    );
    expect(r['SHA-256']).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
    expect(r.MD5).toBe('80070713463e7749b90c2dc24911e275');
    expect(r['Keccak-256']).toBeUndefined();
  });

  it('streams chunks with the same result as one-shot hashing', () => {
    const data = new TextEncoder().encode('x'.repeat(100_003));
    const h = createMultiHasher(['SHA-256', 'MD5']);
    for (let i = 0; i < data.length; i += 4096) h.update(data.subarray(i, i + 4096));
    expect(h.digest('hex')).toEqual(hashText('x'.repeat(100_003), ['SHA-256', 'MD5']));
    expect(() => createMultiHasher([])).toThrow();
  });

  it('compares digests safely', () => {
    expect(digestsEqual(' ABCDEF ', 'abcdef')).toBe(true);
    expect(digestsEqual('abc', 'abd')).toBe(false);
    expect(digestsEqual('', '')).toBe(false);
  });
});
