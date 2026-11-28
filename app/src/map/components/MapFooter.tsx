import { mapChrome } from '@huntclub/design';
import { StyleSheet, View } from 'react-native';

import { spacing, textStyles } from '../../theme';
import { HaloText } from './HaloText';
import { ScaleBar } from './ScaleBar';

/** The gap between the scale and the credit. */
export const FOOTER_GAP = spacing.sm + spacing.xs;

/**
 * The one footer line (docs/DESIGN.md "Map chrome" 6): the scale bar and its length, then the
 * basemap's credit, bottom left above the sheet's peek. Nothing covers the credit; the full
 * attribution is in Map layers.
 */
export function MapFooter({ lat, zoom, credit }: { lat: number; zoom: number; credit: string }) {
  return (
    <View style={styles.line} pointerEvents="none">
      <ScaleBar lat={lat} zoom={zoom} />
      <HaloText style={styles.credit}>{credit}</HaloText>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    minHeight: mapChrome.footer.height,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: FOOTER_GAP,
  },
  credit: textStyles.markerDetail,
});
