import { StyleSheet, View } from 'react-native';

import { makeStyles, radii, sizes } from '../theme';

/**
 * The selected item's edge (docs/DESIGN.md: orange's third job): a 2 px accent edge with a
 * 2 px orange line inside it. In the dark theme both are orange; in daylight the outer edge
 * is ink, so the orange still passes 3:1 against white. Give the selected control
 * `selectedEdge` and put this inside it, as its last child.
 */
export function SelectedOutline({ radius = radii.md }: { radius?: number }) {
  const styles = useSelectedStyles();
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[styles.inner, { borderRadius: radius - sizes.selectedBorder }]}
    />
  );
}

/** `selectedEdge` (the outer edge) for the selected control's own style. */
export const useSelectedStyles = makeStyles((theme) => ({
  selectedEdge: { borderWidth: sizes.selectedBorder, borderColor: theme.colors.accentBorder },
  inner: {
    ...StyleSheet.absoluteFill,
    borderWidth: sizes.selectedBorder,
    borderColor: theme.colors.accent,
  },
}));
