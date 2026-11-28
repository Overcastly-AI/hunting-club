import { mapChrome } from '@huntclub/design';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { makeStyles, radii } from '../../theme';
import { LayersIcon, LocateIcon, NorthIcon } from '../../components/icons';

/** Each control's spoken name. */
export const CONTROL_LABELS = {
  layers: 'Map layers',
  findMe: 'Find me',
  northUp: 'Turn the map north up',
} as const;

/** The map counts as turned once its bearing is this many degrees off north. */
const ROTATED_DEG = 0.5;

/** Whether the map is turned away from north up (the compass shows only then). */
export const isRotated = (bearing: number) => {
  const off = ((bearing % 360) + 360) % 360;
  return Math.min(off, 360 - off) >= ROTATED_DEG;
};

type Props = {
  onLayers: () => void;
  onCenterOnMe: () => void;
  /** The map's bearing: a compass shows only while it is turned. */
  bearing: number;
  onNorthUp: () => void;
};

/**
 * The right-edge icon stack (docs/DESIGN.md "Map chrome" 3): 48 px icon buttons 8 px apart,
 * Layers and Find me, each with a spoken name. No zoom buttons (pinch zooms); a compass,
 * its needle on north, shows only while the map is turned, and a tap turns it north up.
 */
export function MapControls({ onLayers, onCenterOnMe, bearing, onNorthUp }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.stack} pointerEvents="box-none">
      <ControlButton label={CONTROL_LABELS.layers} onPress={onLayers} icon={<LayersIcon />} />
      <ControlButton label={CONTROL_LABELS.findMe} onPress={onCenterOnMe} icon={<LocateIcon />} />
      {isRotated(bearing) ? (
        <ControlButton
          label={CONTROL_LABELS.northUp}
          onPress={onNorthUp}
          icon={
            <View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
              <NorthIcon />
            </View>
          }
        />
      ) : null}
    </View>
  );
}

function ControlButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {icon}
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  stack: { gap: mapChrome.stack.gap },
  // Squared icon buttons, each its own small plate on the imagery.
  button: {
    width: mapChrome.stack.button,
    height: mapChrome.stack.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.plate,
  },
  pressed: { backgroundColor: theme.colors.raised },
}));
