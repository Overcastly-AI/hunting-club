import { StyleSheet, View } from 'react-native';

import type { StandType } from '@huntclub/shared';
import { colors, sizes } from '../theme';

/**
 * Small icons drawn with views (no icon font or SVG dependency). Every
 * control that shows one also has a word label.
 */
type IconProps = { color?: string };

const S = sizes.icon;
const LINE = sizes.hairline;

/** Two stacked sheets. */
export function LayersIcon({ color = colors.text }: IconProps) {
  return (
    <View style={styles.box}>
      <View style={[styles.sheet, { borderColor: color, top: 2 }]} />
      <View style={[styles.sheet, { borderColor: color, top: 9, backgroundColor: color }]} />
    </View>
  );
}

/** Up arrow with a red north tip. */
export function NorthIcon({ color = colors.text }: IconProps) {
  return (
    <View style={styles.box}>
      <View style={[styles.triangleUp, { borderBottomColor: colors.alert }]} />
      <View style={[styles.triangleDown, { borderTopColor: color }]} />
    </View>
  );
}

/** Crosshair. */
export function LocateIcon({ color = colors.text }: IconProps) {
  return (
    <View style={styles.box}>
      <View style={[styles.ring, { borderColor: color }]} />
      <View style={[styles.hLine, { backgroundColor: color }]} />
      <View style={[styles.vLine, { backgroundColor: color }]} />
    </View>
  );
}

/** Arrow pointing `towardDeg` clockwise from north (up): where the wind blows toward. */
export function WindArrowIcon({
  towardDeg,
  color = colors.wind,
}: IconProps & { towardDeg: number }) {
  return (
    <View style={[styles.box, { transform: [{ rotate: `${towardDeg}deg` }] }]}>
      <View style={[styles.triangleUp, { borderBottomColor: color }]} />
      <View style={[styles.shaft, { backgroundColor: color }]} />
    </View>
  );
}

/** Tree stand: post with a seat. Ladder: two rails and rungs. Ground blind: a tent. */
export function StandTypeIcon({ type, color = colors.text }: IconProps & { type: StandType }) {
  if (type === 'ground_blind') {
    return (
      <View style={styles.box}>
        <View style={[styles.tent, { borderBottomColor: color }]} />
      </View>
    );
  }
  if (type === 'ladder') {
    return (
      <View style={styles.box}>
        <View style={[styles.rail, { left: 5, backgroundColor: color }]} />
        <View style={[styles.rail, { right: 5, backgroundColor: color }]} />
        {[4, 10, 16].map((top) => (
          <View key={top} style={[styles.rung, { top, backgroundColor: color }]} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <View style={[styles.seat, { backgroundColor: color }]} />
      <View style={[styles.post, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: S, height: S, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    position: 'absolute',
    left: 2,
    width: S - 4,
    height: 10,
    borderWidth: LINE,
    borderRadius: 3,
    transform: [{ scaleY: 0.8 }],
  },
  triangleUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  triangleDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  shaft: { width: LINE + 1, height: 10 },
  ring: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: LINE },
  hLine: { position: 'absolute', width: S, height: LINE },
  vLine: { position: 'absolute', width: LINE, height: S },
  tent: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  rail: { position: 'absolute', top: 1, width: LINE, height: S - 2 },
  rung: { position: 'absolute', left: 5, right: 5, height: LINE },
  seat: { width: 14, height: 4, borderRadius: 1, marginBottom: 1 },
  post: { width: LINE + 1, height: 14 },
});
