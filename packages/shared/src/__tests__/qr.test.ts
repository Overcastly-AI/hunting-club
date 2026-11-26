import { QR_QUIET_ZONE_MODULES, qrMatrix, qrPath, qrSvg } from '../qr';

/** Every QR code has a 7×7 finder pattern in three corners: a dark ring around a dark 3×3 core. */
function hasFinderAt(rows: boolean[][], top: number, left: number): boolean {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (rows[top + r]![left + c] !== (ring || core)) return false;
    }
  }
  return true;
}

describe('qrMatrix', () => {
  it('builds a square matrix with the three finder patterns', () => {
    const { size, rows } = qrMatrix('https://example.com/join?p=abc');
    expect(rows).toHaveLength(size);
    expect(rows.every((row) => row.length === size)).toBe(true);
    expect((size - 17) % 4).toBe(0); // sizes are 21, 25, 29…
    expect(hasFinderAt(rows, 0, 0)).toBe(true);
    expect(hasFinderAt(rows, 0, size - 7)).toBe(true);
    expect(hasFinderAt(rows, size - 7, 0)).toBe(true);
  });

  it('grows with longer text and is the same every time', () => {
    const short = qrMatrix('hi');
    const long = qrMatrix('x'.repeat(200));
    expect(long.size).toBeGreaterThan(short.size);
    expect(qrMatrix('hi')).toEqual(short);
  });
});

describe('qrPath', () => {
  it('draws one square per dark module, inside the quiet zone', () => {
    const q = QR_QUIET_ZONE_MODULES;
    expect(
      qrPath([
        [true, false],
        [false, true],
      ]),
    ).toBe(`M${q},${q}h1v1h-1zM${q + 1},${q + 1}h1v1h-1z`);
  });
});

describe('qrSvg', () => {
  it('draws the shared path with the quiet zone, dark on light, with an escaped label', () => {
    const value = 'https://example.com/join#cs=abc';
    const { rows } = qrMatrix(value);
    const extent = rows.length + 2 * QR_QUIET_ZONE_MODULES;
    const svg = qrSvg(value, { label: 'Invite "QR" & more', size: 200 });
    expect(svg).toContain(`viewBox="0 0 ${extent} ${extent}" width="200" height="200"`);
    expect(svg).toContain(`<path d="${qrPath(rows)}" fill="var(--color-surface)"/>`);
    expect(svg).toContain('fill="var(--color-text)"');
    expect(svg).toContain('aria-label="Invite &quot;QR&quot; &amp; more"');
    expect(svg).toContain('role="img"');
  });
});
