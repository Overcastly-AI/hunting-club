import { qrMatrix } from '@huntclub/shared/qr';

/** Quiet zone the QR spec requires around the code, in modules. */
const QUIET_ZONE = 4;

/**
 * Draws a QR code as SVG from the shared encoder (@huntclub/shared/qr): one path of
 * dark modules on a light background, which is what phone cameras read most reliably.
 */
export function QrCode(props: { value: string; label: string; size?: number }) {
  const matrix = qrMatrix(props.value);
  const extent = matrix.size + QUIET_ZONE * 2;
  let path = '';
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.isDark(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return (
    <svg
      role="img"
      aria-label={props.label}
      viewBox={`0 0 ${extent} ${extent}`}
      width={props.size ?? 280}
      height={props.size ?? 280}
      shapeRendering="crispEdges"
    >
      {/* QR codes must be dark on light; the design tokens' text color is the light one. */}
      <rect width={extent} height={extent} fill="var(--color-text)" />
      <path d={path} fill="var(--color-surface)" />
    </svg>
  );
}
