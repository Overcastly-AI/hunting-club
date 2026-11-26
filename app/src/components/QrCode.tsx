import { QR_QUIET_ZONE_MODULES, qrMatrix } from '@huntclub/shared';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

type Props = {
  value: string;
  /** Width and height in points, quiet zone included. */
  size: number;
  accessibilityLabel: string;
};

/** SVG path drawing every dark module as a 1×1 square, offset by the quiet zone. */
export function qrPath(rows: readonly (readonly boolean[])[]): string {
  const q = QR_QUIET_ZONE_MODULES;
  return rows
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + q},${y + q}h1v1h-1z` : '')))
    .join('');
}

/**
 * A QR code from the shared encoder (@huntclub/shared qrMatrix). Always dark
 * on light, whatever the theme, so phone cameras can read it.
 */
export function QrCode({ value, size, accessibilityLabel }: Props) {
  const { size: modules, rows } = useMemo(() => qrMatrix(value), [value]);
  const span = modules + 2 * QR_QUIET_ZONE_MODULES;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Rect width={span} height={span} fill={colors.text} />
      <Path d={qrPath(rows)} fill={colors.mapHalo} />
    </Svg>
  );
}
