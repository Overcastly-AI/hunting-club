import { QR_QUIET_ZONE_MODULES } from '@huntclub/shared';

import { qrPath } from '../QrCode';

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
