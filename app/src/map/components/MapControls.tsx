import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles } from '../../theme';
import { LayersIcon, LocateIcon, NorthIcon } from '../../components/icons';

type Props = { onLayers: () => void; onNorthUp: () => void; onCenterOnMe: () => void };

/** Right-side controls: map layers, north-up, center on me. Each has a word label. */
export function MapControls({ onLayers, onNorthUp, onCenterOnMe }: Props) {
  const styles = useStyles();
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
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  column: { gap: spacing.sm },
  button: {
    width: sizes.control,
    minHeight: sizes.control,
    borderRadius: radii.md,
    // Floating over the map in either theme: a 3:1 control edge so the button reads on imagery.
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
    backgroundColor: theme.colors.surface0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  pressed: { backgroundColor: theme.colors.surface2 },
  label: { ...textStyles.badge, color: theme.colors.text },
}));
