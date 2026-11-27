import { Pressable, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { SelectedOutline, useSelectedStyles } from '../../components/SelectedOutline';
import { basemapSwatch, makeStyles, radii, sizes, spacing, textStyles } from '../../theme';
import type { BasemapView } from '../basemaps';

/** The thumbnail's drawing space: wide, short. */
const W = 100;
const H = 56;

/** A creek across the picture, and two contour lines. */
const CREEK = 'M0 44 C 25 30, 45 52, 70 36 S 100 30, 100 30';
const CONTOURS = ['M0 20 C 30 8, 60 30, 100 14', 'M0 32 C 35 18, 65 42, 100 26'];

/** A little picture of each basemap: aerial timber and a field, a paper topo, or both. */
function Swatch({ view }: { view: BasemapView }) {
  const aerial = view !== 'topo';
  return (
    <Svg width="100%" height={sizes.swatchHeight} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Rect width={W} height={H} fill={aerial ? basemapSwatch.woods : basemapSwatch.paper} />
      {aerial ? (
        <Path d="M58 8 L92 12 L88 40 L60 36 Z" fill={basemapSwatch.field} />
      ) : (
        <Path d="M0 0 H44 C 40 20, 20 30, 0 34 Z" fill={basemapSwatch.paperWoods} />
      )}
      <Path
        d={CREEK}
        fill="none"
        stroke={aerial ? basemapSwatch.water : basemapSwatch.topoWater}
        strokeWidth={3}
      />
      {view === 'aerial'
        ? null
        : CONTOURS.map((d) => (
            <Path
              key={d}
              d={d}
              fill="none"
              stroke={view === 'hybrid' ? basemapSwatch.hybridContour : basemapSwatch.contour}
              strokeWidth={1}
            />
          ))}
    </Svg>
  );
}

type Props = { view: BasemapView; label: string; selected: boolean; onPress: () => void };

/** One basemap in the layers sheet: its picture over its name; the chosen one has the orange edge. */
export function BasemapThumb({ view, label, selected, onPress }: Props) {
  const styles = useStyles();
  const selectedStyles = useSelectedStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.thumb,
        pressed && styles.pressed,
        selected && selectedStyles.selectedEdge,
      ]}
    >
      <View
        style={styles.picture}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Swatch view={view} />
      </View>
      <Text style={styles.label}>{label}</Text>
      {selected ? <SelectedOutline /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  thumb: {
    flex: 1,
    minHeight: sizes.minTapTarget,
    gap: spacing.xs,
    padding: spacing.xs,
    paddingBottom: spacing.sm - 2,
    borderRadius: radii.md,
    borderWidth: sizes.controlBorder,
    borderColor: theme.colors.borderSubtle,
  },
  pressed: { backgroundColor: theme.colors.raised },
  picture: { borderRadius: radii.sm, overflow: 'hidden' },
  label: { ...textStyles.label, color: theme.colors.text, textAlign: 'center' },
}));
