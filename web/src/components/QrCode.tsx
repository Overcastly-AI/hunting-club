import { QR_QUIET_ZONE_MODULES, qrMatrix } from '@huntclub/shared';
import { useMemo } from 'react';

/**
 * Draws a QR code as SVG from the shared encoder (`qrMatrix` in @huntclub/shared, the
 * same one the app's QR uses): dark modules on a light background with the quiet zone
 * scanners need, which is what phone cameras read most reliably.
 */
export function QrCode(props: { value: string; label: string; size?: number }) {
  const { value } = props;
  const path = useMemo(() => {
    const { rows } = qrMatrix(value);
    let d = '';
    rows.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) d += `M${c + QR_QUIET_ZONE_MODULES} ${r + QR_QUIET_ZONE_MODULES}h1v1h-1z`;
      }),
    );
    return { d, extent: rows.length + 2 * QR_QUIET_ZONE_MODULES };
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
