import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, mapTextHalo, textStyles } from '../../theme';

/** Map labels follow the system text size up to 200% (spec), then stop so markers stay on the map. */
export const MAP_TEXT_MAX_SCALE = 2;

/** Text drawn on the map: at least 13 px with the dark map-halo outline. */
export function HaloText({ style, ...props }: TextProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAP_TEXT_MAX_SCALE}
      {...props}
      style={[styles.text, style, mapTextHalo]}
    />
  );
}

const styles = StyleSheet.create({
  text: { ...textStyles.mapLabel, color: colors.text },
});
