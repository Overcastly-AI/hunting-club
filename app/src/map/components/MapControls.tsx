import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, opacity, radii, sizes, spacing, textStyles } from '../../theme';
import { LayersIcon, LocateIcon, NorthIcon } from './icons';

type Props = { onLayers: () => void; onNorthUp: () => void; onCenterOnMe: () => void };

/** Right-side controls: map layers, north-up, center on me. Each has a word label. */
export function MapControls({ onLayers, onNorthUp, onCenterOnMe }: Props) {
  return (
    <View style={styles.column}>
      <ControlButton
        label="Layers"
        a11y="Map layers and downloads"
        onPress={onLayers}
        icon={<LayersIcon />}
      />
      <ControlButton
        label="North"
        a11y="Turn the map north up"
        onPress={onNorthUp}
        icon={<NorthIcon />}
      />
      <ControlButton
        label="Me"
        a11y="Center the map on me"
        onPress={onCenterOnMe}
        icon={<LocateIcon />}
      />
    </View>
  );
}

function ControlButton({
  label,
  a11y,
  onPress,
  icon,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  icon: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.pressed }]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.sm },
  button: {
    width: sizes.control,
    minHeight: sizes.control,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  label: { ...textStyles.mapLabel, color: colors.text },
});
