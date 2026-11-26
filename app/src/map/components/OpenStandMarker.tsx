import { StyleSheet, View } from 'react-native';

import { colors, radii, sizes, spacing, textStyles } from '../../theme';
import { OPEN_STAND, openStandAccessibilityLabel } from '../labels';
import type { OpenStandOnMap } from '../types';
import { HaloText } from './HaloText';
import { StandTypeIcon } from '../../components/icons';

/** A club stand nobody is in: rounded square with the stand-type icon, name and "Open". */
export function OpenStandMarker({ stand }: { stand: OpenStandOnMap }) {
  return (
    <View
      accessible
      accessibilityLabel={openStandAccessibilityLabel(stand)}
      style={styles.container}
    >
      <View style={styles.square}>
        <StandTypeIcon type={stand.type} />
      </View>
      <HaloText style={styles.name} numberOfLines={1}>
        {stand.name}
      </HaloText>
      <HaloText style={styles.open}>{OPEN_STAND}</HaloText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', minWidth: sizes.minTapTarget, paddingTop: spacing.xs },
  square: {
    width: sizes.standMarker,
    height: sizes.standMarker,
    borderRadius: radii.standMarker,
    borderWidth: sizes.hairline,
    borderColor: colors.text,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...textStyles.markerName, marginTop: spacing.xs },
  open: { color: colors.fresh },
});
