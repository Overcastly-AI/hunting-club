import { QR_QUIET_ZONE_MODULES, qrMatrix, qrPath } from '@huntclub/shared';
import { useMemo } from 'react';

/**
 * Draws a QR code as SVG from the shared encoder and path (`qrMatrix`, `qrPath` in
 * @huntclub/shared, the same ones the app's QR uses): dark modules on a light background
 * with the quiet zone scanners need, which is what phone cameras read most reliably.
 */
export function QrCode(props: { value: string; label: string; size?: number }) {
  const { value } = props;
  const path = useMemo(() => {
    const { rows } = qrMatrix(value);
    return { d: qrPath(rows), extent: rows.length + 2 * QR_QUIET_ZONE_MODULES };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={props.label}
      viewBox={`0 0 ${path.extent} ${path.extent}`}
      width={props.size ?? 280}
      height={props.size ?? 280}
      shapeRendering="crispEdges"
    >
      {/* QR codes must be dark on light; the design tokens' text color is the light one. */}
      <rect width={path.extent} height={path.extent} fill="var(--color-text)" />
      <path d={path.d} fill="var(--color-surface)" />
    </svg>
  );
}
