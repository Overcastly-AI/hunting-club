import { create, type QRCodeErrorCorrectionLevel } from 'qrcode';

/**
 * The one QR encoder (app Party/Club QR, web admin invite page). Medium error
 * correction survives a scratched phone screen or a printed sheet in the rain.
 */
export const QR_ERROR_CORRECTION: QRCodeErrorCorrectionLevel = 'M';

/** Modules a QR scanner needs blank around the code. */
export const QR_QUIET_ZONE_MODULES = 4;

/** Square QR module matrix: `rows[row][col]` is true for a dark module. */
export type QrMatrix = { size: number; rows: boolean[][] };

/** Encodes `text` as a QR code; renderers draw the dark modules. */
export function qrMatrix(text: string): QrMatrix {
  const { modules } = create(text, { errorCorrectionLevel: QR_ERROR_CORRECTION });
  const rows = Array.from({ length: modules.size }, (_, row) =>
    Array.from({ length: modules.size }, (_, col) => Boolean(modules.get(row, col))),
  );
  return { size: modules.size, rows };
}
