import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, opacity, radii, sizes, spacing, textStyles } from '../../theme';
import type { LatLon } from '../../domain/location';
import type { WeatherDisplay } from '../../weather/display';
import { ConditionsPanel } from './ConditionsPanel';

type Props = {
  /** "Party" for free users, the club name for clubs. */
  groupLabel: string;
  onGroupPress: () => void;
  conditionsPlace: LatLon | null;
  now: number;
  weather: WeatherDisplay;
};

/** Party or club button beside the conditions panel. */
export function TopBar({ groupLabel, onGroupPress, conditionsPlace, now, weather }: Props) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={groupLabel}
        accessibilityHint="Opens your party or club"
        onPress={onGroupPress}
        style={({ pressed }) => [styles.group, pressed && { opacity: opacity.pressed }]}
      >
        <Text style={styles.groupText} numberOfLines={2}>
          {groupLabel}
        </Text>
      </Pressable>
      <ConditionsPanel place={conditionsPlace} now={now} weather={weather} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  group: {
    minWidth: sizes.control + spacing.lg,
    minHeight: sizes.control,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupText: { ...textStyles.label, color: colors.text },
});
