import type { StandType } from '@huntclub/shared';
import { MapPin } from 'lucide-react-native';
import { View } from 'react-native';

import { ICON_SIZE, makeStyles, radii, sizes, useTheme } from '../theme';
import { StandTypeIcon } from './icons';

/**
 * A stand: its type's icon in a 38 px rounded square with a control edge, in the Check In list,
 * the sheet and the clubhouse board. The Map tab draws it at `size` (mapChrome.labels.marker,
 * 32 px). A pin when the type isn't known.
 */
export function StandSquare({
  type,
  testID,
  size = sizes.standMarker,
}: {
  type?: StandType;
  testID?: string;
  size?: number;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View testID={testID} style={[styles.square, { width: size, height: size }]}>
      {type ? (
        <StandTypeIcon type={type} />
      ) : (
        <MapPin
          size={ICON_SIZE.md}
          color={theme.colors.text}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  square: {
    borderRadius: radii.standMarker,
    borderWidth: sizes.controlBorder,
    borderColor: theme.colors.borderControl,
    backgroundColor: theme.colors.plate,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
