import { describeFreshness, type Freshness } from '@huntclub/shared';
import { Text, View } from 'react-native';

import {
  makeStyles,
  maxFontScale,
  opacity,
  radii,
  sizes,
  textStyles,
  useTheme,
  type ThemeColorToken,
} from '../../theme';
import { hunterAccessibilityLabel, hunterPlateDetail, placeLabel } from '../labels';
import type { HunterOnMap } from '../types';
import { MarkerHitArea, MarkerPlate } from './MarkerPlate';

type Props = {
  hunter: HunterOnMap;
  now: number;
  /** Just the ring and initials, no plate (the chat's strip of map). */
  compact?: boolean;
};

/**
 * The freshness ring (docs/DESIGN.md "A ring that tells the truth"): solid green when the
 * radio was heard just now, broken gold when it was not, and a faded grey ring with a faded
 * circle for an old, last known position. An old position is never drawn as a live one.
 */
export const FRESHNESS_RING: Record<
  Freshness,
  { color: ThemeColorToken; borderStyle: 'solid' | 'dashed'; opacity: number }
> = {
  fresh: { color: 'fresh', borderStyle: 'solid', opacity: 1 },
  stale: { color: 'stale', borderStyle: 'dashed', opacity: 1 },
  faded: { color: 'textSecondary', borderStyle: 'solid', opacity: opacity.faded },
};

/**
 * Another hunter: initials in a 42 px circle with the freshness ring, in a box padded to
 * 48 px, and a plate with where they are and how long ago their radio was heard.
 */
export function HunterMarker({ hunter, now, compact }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const view = describeFreshness(hunter.heardAt, now);
  const ring = FRESHNESS_RING[view.freshness];
  return (
    <View accessible accessibilityLabel={hunterAccessibilityLabel(hunter, now)} style={styles.row}>
      <MarkerHitArea testID="hunter-hit-area">
        {/* Only the circle fades: the plate keeps full contrast, and its age says how old. */}
        <View
          testID="freshness-ring"
          style={[
            styles.circle,
            styles[ring.borderStyle],
            { borderColor: theme.colors[ring.color], opacity: ring.opacity },
          ]}
        >
          <Text maxFontSizeMultiplier={maxFontScale} style={styles.initials}>
            {hunter.initials}
          </Text>
        </View>
      </MarkerHitArea>
      {compact ? null : (
        <MarkerPlate title={placeLabel(hunter.place)} detail={hunterPlateDetail(hunter, now)} />
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  // A minimum, not a fixed size: at the largest text sizes the initials grow and the circle with them.
  circle: {
    minWidth: sizes.hunterMarker,
    minHeight: sizes.hunterMarker,
    borderRadius: radii.full,
    borderWidth: sizes.freshnessRing,
    backgroundColor: theme.colors.plate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { borderStyle: 'solid' },
  dashed: { borderStyle: 'dashed' },
  initials: { ...textStyles.markerName, color: theme.colors.text },
}));
