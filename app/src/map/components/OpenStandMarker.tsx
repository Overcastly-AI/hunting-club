import { Pressable, View } from 'react-native';

import { StandSquare } from '../../components/StandSquare';
import { makeStyles, sizes } from '../../theme';
import { OPEN_STAND, openStandAccessibilityLabel } from '../labels';
import type { OpenStandOnMap } from '../types';
import { MarkerHitArea, MarkerPlate } from './MarkerPlate';

type Props = {
  stand: OpenStandOnMap;
  /**
   * The Map tab's labels (docs/DESIGN.md "Map chrome" 8): `name` is the capped one-line label,
   * `none` the icon only. Elsewhere (the clubhouse board) the full plate with "Available".
   */
  label?: 'full' | 'name' | 'none';
  /** A tap on the stand: shows its name when it is an icon only. */
  onPress?: () => void;
};

/**
 * A club stand nobody is in: a 38 px rounded square with the stand-type icon, in a box padded
 * to 48 px, and a plate with its name and "Available" in fresh green.
 */
export function OpenStandMarker({ stand, label = 'full', onPress }: Props) {
  const styles = useStyles();
  const body = (
    <>
      <MarkerHitArea testID="stand-hit-area">
        <StandSquare testID="stand-square" type={stand.type} />
      </MarkerHitArea>
      {label === 'none' ? null : (
        <MarkerPlate
          title={stand.name}
          detail={OPEN_STAND}
          detailTone="fresh"
          cap={label === 'name'}
        />
      )}
    </>
  );
  const spoken = openStandAccessibilityLabel(stand);
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={spoken} style={styles.row}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={[styles.row, styles.tappable]}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  tappable: { minHeight: sizes.minTapTarget },
}));
