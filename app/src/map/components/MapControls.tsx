import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles } from '../../theme';
import { LayersIcon, LocateIcon, NorthIcon } from '../../components/icons';

type Props = { onLayers: () => void; onNorthUp: () => void; onCenterOnMe: () => void };

/**
 * The right-hand control column (docs/DESIGN.md "Deliberately different from onX"): one
 * squared plate of three controls, each with a word: Layers, North, Find me.
 */
export function MapControls({ onLayers, onNorthUp, onCenterOnMe }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.column}>
      <ControlButton
        label="Layers"
        a11y="Map layers and downloads"
        onPress={onLayers}
        icon={<LayersIcon />}
        first
      />
      <ControlButton
        label="North"
        a11y="Turn the map north up"
        onPress={onNorthUp}
        icon={<NorthIcon />}
      />
      <ControlButton
        label="Find me"
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
  first,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  icon: ReactNode;
  first?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.button, !first && styles.divided, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  column: {
    width: sizes.mapToolWidth,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.plate,
    overflow: 'hidden',
  },
  button: {
    minHeight: sizes.mapToolHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs / 2,
  },
  divided: { borderTopWidth: 1, borderColor: theme.colors.borderSubtle },
  pressed: { backgroundColor: theme.colors.raised },
  label: { ...textStyles.markerDetail, color: theme.colors.text, textAlign: 'center' },
}));
