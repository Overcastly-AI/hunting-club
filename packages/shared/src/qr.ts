import QRCode from 'qrcode';

/**
 * A QR code as a grid of modules: the single encoder for every QR the project shows
 * (party and club invites). Each platform draws the grid itself: the web page as SVG,
 * the app (later) with react-native-svg. Kept out of the package index so code that
 * never shows a QR doesn't bundle the encoder: import from '@huntclub/shared/qr'.
 */
export interface QrMatrix {
  /** Modules per side (21 for version 1, +4 per version). */
  readonly size: number;
  isDark(row: number, column: number): boolean;
}

/**
 * Error correction level M (about 15% damage tolerated): a good fit for a code shown on
 * a phone or printed in the clubhouse, without making long invite links too dense.
 */
export function qrMatrix(text: string): QrMatrix {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules;
  return { size, isDark: (row, column) => data[row * size + column] === 1 };
}
