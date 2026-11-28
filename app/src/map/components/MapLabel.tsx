import { mapChrome } from '@huntclub/design';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { archivo, makeStyles, maxFontScale } from '../../theme';

const { text: LABEL_TEXT, maxWidth: LABEL_MAX_WIDTH } = mapChrome.labels;

/**
 * Where the halo's copies sit around the text: eight steps of `halo` px around a circle. React
 * Native has no text stroke, and a text shadow blurs, so the halo is the name drawn in the halo
 * colour at each step, under the name itself. The same on iOS and Android.
 */
export const HALO_STEPS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    dx: round(Math.cos(angle) * LABEL_TEXT.halo),
    dy: round(Math.sin(angle) * LABEL_TEXT.halo),
  };
});

type Props = {
  /** The words as drawn (`mapLabelText`: cut to fit the label's 140 px). */
  text: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** `none` for a name that takes no taps (an area's), so they reach what is under it. */
  pointerEvents?: 'none' | 'auto';
};

/**
 * A name on the map with no box (docs/DESIGN.md "Map chrome" 8, `mapChrome.labels.text`): 13 px
 * semibold in the theme's `text` colour on a 2 px halo of its `plate` colour (light on dark in
 * the dark theme, dark on light in daylight), one line within the 140 px cap. Only the name is
 * read out; the halo's copies are hidden from screen readers.
 */
export function MapLabel({ text, style, testID, pointerEvents = 'auto' }: Props) {
  const styles = useStyles();
  return (
    <View testID={testID} pointerEvents={pointerEvents} style={[styles.label, style]}>
      <View
        style={styles.haloLayer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {HALO_STEPS.map(({ dx, dy }) => (
          <Text
            key={`${dx},${dy}`}
            numberOfLines={1}
            maxFontSizeMultiplier={maxFontScale}
            style={[
              styles.text,
              styles.halo,
              {
                left: LABEL_TEXT.halo + dx,
                right: LABEL_TEXT.halo - dx,
                top: LABEL_TEXT.halo + dy,
              },
            ]}
          >
            {text}
          </Text>
        ))}
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  label: { maxWidth: LABEL_MAX_WIDTH, padding: LABEL_TEXT.halo },
  haloLayer: { ...StyleSheet.absoluteFill },
  text: {
    ...archivo(LABEL_TEXT.weight),
    fontSize: LABEL_TEXT.size,
    color: theme.colors[LABEL_TEXT.color],
  },
  halo: { position: 'absolute', color: theme.colors[LABEL_TEXT.haloColor] },
}));
