import { qrMatrix } from '@huntclub/shared/qr';

describe('shared QR encoder', () => {
  it('produces a valid QR size with finder patterns in three corners', () => {
    const m = qrMatrix('https://huntclub-dev.jaycobjones.com/join#cs=abc');
    expect((m.size - 21) % 4).toBe(0);
    const corners: [number, number][] = [
      [0, 0],
      [0, m.size - 7],
      [m.size - 7, 0],
    ];
    for (const [r, c] of corners) {
      // The 7x7 finder: dark outer ring, light ring inside it, dark centre.
      expect(m.isDark(r, c)).toBe(true);
      expect(m.isDark(r + 1, c + 1)).toBe(false);
      expect(m.isDark(r + 3, c + 3)).toBe(true);
    }
  });

  it('grows with the payload', () => {
    expect(qrMatrix('x'.repeat(300)).size).toBeGreaterThan(qrMatrix('x').size);
  });
});
