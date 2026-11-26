import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, mapTextHalo, maxFontScale, textStyles } from '../../theme';

/**
 * Text drawn on the map: at least 13 px with the dark map-halo outline. Follows
 * the system text size up to `maxFontScale`, then stops so markers stay on the map.
 */
export function HaloText({ style, ...props }: TextProps) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontScale}
      {...props}
      style={[styles.text, style, mapTextHalo]}
    />
  );
}

const styles = StyleSheet.create({
  text: { ...textStyles.mapLabel, color: colors.text },
});
