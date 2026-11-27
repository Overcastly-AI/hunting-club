import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { makeStyles, opacity, radii, sizes, spacing, textStyles } from '../../theme';

/**
 * A marker sits on its point inside a box padded to the 48 px tap minimum, with its plate to
 * the right. MapLibre anchors the marker by its left edge; this offset puts the centre of a
 * `box` px box at the start of the row (the circle, square or your dot) on the point.
 */
export function markerAnchor(box: number): { anchor: 'left'; offset: [number, number] } {
  return { anchor: 'left', offset: [-box / 2, 0] };
}

/** Hunters and stands: the centre of the 48 px box on the point. */
export const MARKER_ANCHOR = markerAnchor(sizes.minTapTarget);

/**
 * The box a hunter or stand marker is drawn in: padded to the 48 px tap minimum around the
 * 42 px circle or 38 px square, so a gloved thumb can hit it while the map stays readable.
 */
export function MarkerHitArea({ children, testID }: { children: ReactNode; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={styles.hitArea}>
      {children}
    </View>
  );
}

type PlateProps = {
  /** First line: the stand, spot or area ("Creek Stand"). */
  title: string;
  /** Second line ("Dale B., 2 min ago"; "Open"). */
  detail?: string;
  /** "Open" is fresh green; everything else is second-line grey. */
  detailTone?: 'quiet' | 'fresh';
};

/**
 * The name plate beside a marker (docs/DESIGN.md "The one memorable element"): the plate
 * colour at 94% over the imagery, so busy aerial never shows through its text.
 */
export function MarkerPlate({ title, detail, detailTone = 'quiet' }: PlateProps) {
  const styles = useStyles();
  return (
    <View style={styles.plate}>
      <View style={styles.backing} />
      <Text style={styles.title}>{title}</Text>
      {detail ? (
        <Text style={[styles.detail, detailTone === 'fresh' && styles.fresh]}>{detail}</Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  hitArea: {
    minWidth: sizes.minTapTarget,
    minHeight: sizes.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    marginLeft: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs + 1,
    borderRadius: radii.markerPlate,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  backing: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.markerPlate,
    backgroundColor: theme.colors.plate,
    opacity: opacity.markerPlate,
  },
  title: { ...textStyles.markerName, color: theme.colors.text },
  detail: { ...textStyles.markerDetail, color: theme.colors.textSecondary },
  fresh: { color: theme.colors.fresh },
}));
