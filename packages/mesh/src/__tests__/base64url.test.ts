import { base64UrlDecode, base64UrlEncode } from '../codec/base64url';

describe('base64url', () => {
  const vectors: [number[], string][] = [
    [[], ''],
    [[0x66], 'Zg'],
    [[0x66, 0x6f], 'Zm8'],
    [[0x66, 0x6f, 0x6f], 'Zm9v'],
    [[0xfb, 0xff], '-_8'],
    [[0xff, 0xff, 0xfe], '___-'],
  ];

  it.each(vectors)('encodes %j as %s without padding', (bytes, text) => {
    expect(base64UrlEncode(Uint8Array.from(bytes))).toBe(text);
    expect([...base64UrlDecode(text)]).toEqual(bytes);
  });

  it('round-trips every length up to 70 bytes', () => {
    for (let n = 0; n <= 70; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 0xff);
      const text = base64UrlEncode(bytes);
      expect(text).not.toMatch(/[=+/]/);
      expect(base64UrlDecode(text)).toEqual(bytes);
    }
  });

  it('accepts padding and standard base64 characters', () => {
    expect([...base64UrlDecode('Zm8=')]).toEqual([0x66, 0x6f]);
    expect([...base64UrlDecode('+/8=')]).toEqual([0xfb, 0xff]);
  });

  it('rejects invalid input', () => {
    expect(() => base64UrlDecode('Zm9v!')).toThrow();
    expect(() => base64UrlDecode('Z')).toThrow();
  });
});
