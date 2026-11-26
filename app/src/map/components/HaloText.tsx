import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, mapTextHalo, textStyles } from '../../theme';

/** Text drawn on the map: at least 13 px with the dark map-halo outline. */
export function HaloText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.text, style, mapTextHalo]} />;
}

const styles = StyleSheet.create({
  text: { ...textStyles.mapLabel, color: colors.text },
});
