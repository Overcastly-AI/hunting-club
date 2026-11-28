import { LABEL_FROM_CENTRE, mapChrome, mapLabelText } from '@huntclub/design';
import { Pressable, View } from 'react-native';

import { StandSquare } from '../../components/StandSquare';
import { makeStyles, sizes } from '../../theme';
import { OPEN_STAND, openStandAccessibilityLabel } from '../labels';
import type { LabelSide } from '../mapLabels';
import type { OpenStandOnMap } from '../types';
import { MapLabel } from './MapLabel';
import { MarkerHitArea, MarkerPlate } from './MarkerPlate';

/** From the 48 px box's edge to the label: the 6 px gap from the 32 px marker, past the box. */
const LABEL_FROM_BOX = LABEL_FROM_CENTRE - sizes.minTapTarget / 2;

type Props = {
  stand: OpenStandOnMap;
  /**
   * The Map tab (docs/DESIGN.md "Map chrome" 8) draws the 32 px marker with its name beside it on
   * this side, no box, or `none` for the icon only. Elsewhere (the clubhouse board), `full`: the
   * 38 px square and the plate with "Available".
   */
  label?: 'full' | 'none' | LabelSide;
  /** A tap on the stand: shows its name when it is an icon only. */
  onPress?: () => void;
};

/**
 * A club stand nobody is in: a rounded square with the stand-type icon, in a box padded to
 * 48 px, and its name. The whole row, name included, is one tap target at least 48 px tall.
 */
export function OpenStandMarker({ stand, label = 'full', onPress }: Props) {
  const styles = useStyles();
  const onMap = label !== 'full';
  const body = (
    <>
      <MarkerHitArea testID="stand-hit-area">
        <StandSquare
          testID="stand-square"
          type={stand.type}
          {...(onMap ? { size: mapChrome.labels.marker } : {})}
        />
      </MarkerHitArea>
      {label === 'full' ? (
        <MarkerPlate title={stand.name} detail={OPEN_STAND} detailTone="fresh" />
      ) : label === 'none' ? null : (
        <MapLabel
          testID="stand-label"
          text={mapLabelText(stand.name).text}
          style={label === 'right' ? styles.labelRight : styles.labelLeft}
        />
      )}
    </>
  );
  const row = [styles.row, label === 'left' && styles.reversed];
  const spoken = openStandAccessibilityLabel(stand);
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={spoken} style={row}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={[row, styles.tappable]}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  reversed: { flexDirection: 'row-reverse' },
  tappable: { minHeight: sizes.minTapTarget },
  // The label's box (its halo inside it) starts 6 px past the marker's edge, as the shared rect.
  labelRight: { marginLeft: LABEL_FROM_BOX },
  labelLeft: { marginRight: LABEL_FROM_BOX },
}));
