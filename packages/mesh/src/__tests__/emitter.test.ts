import { Emitter } from '../emitter';
import { defaultRandom, randomUint32 } from '../random';

class TestEmitter extends Emitter<{ n: number; s: string }> {
  fire<K extends 'n' | 's'>(k: K, v: { n: number; s: string }[K]) {
    this.emit(k, v);
  }
}

describe('Emitter', () => {
  it('delivers, unsubscribes and fires once listeners once', () => {
    const e = new TestEmitter();
    const got: number[] = [];
    const off = e.on('n', (v) => got.push(v));
    e.once('n', (v) => got.push(v * 10));
    e.fire('n', 1);
    e.fire('n', 2);
    off();
    e.fire('n', 3);
    e.fire('s', 'no listeners is fine');
    expect(got).toEqual([1, 10, 2]);
  });

  it('a throwing listener does not stop the others', () => {
    const e = new TestEmitter();
    const got: string[] = [];
    e.on('s', () => {
      throw new Error('boom');
    });
    e.on('s', (v) => got.push(v));
    expect(() => e.fire('s', 'ok')).not.toThrow();
    expect(got).toEqual(['ok']);
  });
});

describe('random', () => {
  it('defaultRandom uses the platform CSPRNG', () => {
    const a = defaultRandom(32);
    expect(a).toHaveLength(32);
    expect(a).not.toEqual(defaultRandom(32));
  });

  it('defaultRandom throws without a CSPRNG', () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(() => defaultRandom(4)).toThrow(/random/);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'crypto', saved);
    }
  });

  it('randomUint32 skips zero', () => {
    const seq = [Uint8Array.of(0, 0, 0, 0), Uint8Array.of(0xff, 0xff, 0xff, 0xff)];
    expect(randomUint32(() => seq.shift()!)).toBe(0xffffffff);
  });
});
