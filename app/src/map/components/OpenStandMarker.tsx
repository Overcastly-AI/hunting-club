import { View } from 'react-native';

import { StandSquare } from '../../components/StandSquare';
import { makeStyles } from '../../theme';
import { OPEN_STAND, openStandAccessibilityLabel } from '../labels';
import type { OpenStandOnMap } from '../types';
import { MarkerHitArea, MarkerPlate } from './MarkerPlate';

/**
 * A club stand nobody is in: a 38 px rounded square with the stand-type icon, in a box padded
 * to 48 px, and a plate with its name and "Available" in fresh green.
 */
export function OpenStandMarker({ stand }: { stand: OpenStandOnMap }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={openStandAccessibilityLabel(stand)} style={styles.row}>
      <MarkerHitArea testID="stand-hit-area">
        <StandSquare testID="stand-square" type={stand.type} />
      </MarkerHitArea>
      <MarkerPlate title={stand.name} detail={OPEN_STAND} detailTone="fresh" />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
}));
