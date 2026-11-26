import { QR_QUIET_ZONE_MODULES, qrMatrix, qrPath } from '@huntclub/shared';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

type Props = {
  value: string;
  /** Width and height in points, quiet zone included. */
  size: number;
  accessibilityLabel: string;
};

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
