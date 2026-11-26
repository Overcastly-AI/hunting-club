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

/**
 * SVG path data for a QR matrix: one 1×1 square per dark module, offset by the quiet
 * zone. The viewBox is `rows.length + 2 * QR_QUIET_ZONE_MODULES` square. Shared by the
 * app and the web page, which only differ in how they draw the SVG.
 */
export function qrPath(rows: readonly (readonly boolean[])[]): string {
  const q = QR_QUIET_ZONE_MODULES;
  return rows
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + q},${y + q}h1v1h-1z` : '')))
    .join('');
}

const escapeAttr = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * A QR code as SVG markup: dark modules on a light background, with the quiet zone.
 * QR codes must be dark on light, and the design tokens' text color is the light one, so
 * the background is --color-text and the modules --color-surface. The one renderer for
 * the web admin's invite QR and the public site's /join page.
 */
export function qrSvg(value: string, opts: { label: string; size?: number }): string {
  const { rows } = qrMatrix(value);
  const extent = rows.length + 2 * QR_QUIET_ZONE_MODULES;
  const size = opts.size ?? 280;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttr(opts.label)}"`,
    ` viewBox="0 0 ${extent} ${extent}" width="${size}" height="${size}" shape-rendering="crispEdges">`,
    `<rect width="${extent}" height="${extent}" fill="var(--color-text)"/>`,
    `<path d="${qrPath(rows)}" fill="var(--color-surface)"/>`,
    '</svg>',
  ].join('');
}
