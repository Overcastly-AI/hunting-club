import type { ConditionsReadout, Wording } from '@huntclub/shared';
import { ChevronDown } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { ICON_SIZE, makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../../theme';
import { MESH_QUIET_DETAIL, MESH_TONE_COLOR, describeMeshStatus } from '../meshStatus';
import type { MeshStatus } from '../types';
import { ReadoutStrip } from './ReadoutStrip';

type Props = {
  /** The club's name, or "Party" for free users. */
  groupLabel: string;
  onGroupPress: () => void;
  mesh: MeshStatus;
  now: number;
  onMeshPress: () => void;
  readout: ConditionsReadout;
  /** "Updated 3 hr ago" once the forecast is old. */
  weatherUpdated?: Wording | null;
};

/**
 * The one plate at the top of the map (docs/DESIGN.md "Layout"): the club or party and the
 * mesh status in the first row, the conditions strip in the second. No logo on the map.
 * When the mesh goes quiet a gold row says plainly that nothing on the map is live.
 */
export function TopPlate({
  groupLabel,
  onGroupPress,
  mesh,
  now,
  onMeshPress,
  readout,
  weatherUpdated,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const status = describeMeshStatus(mesh, now);
  const quiet = status.tone === 'quiet' && mesh.lastHeardAt !== null;
  return (
    <View style={styles.plate}>
      <View style={styles.who}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={groupLabel}
          accessibilityHint="Opens your party or club"
          onPress={onGroupPress}
          style={({ pressed }) => [styles.cell, styles.group, pressed && styles.pressed]}
        >
          <Text style={styles.groupText}>{groupLabel}</Text>
          <ChevronDown
            size={ICON_SIZE.md}
            color={theme.colors.textSecondary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={quiet ? `${status.text}. ${MESH_QUIET_DETAIL}` : status.text}
          accessibilityHint="Opens radio details"
          accessibilityLiveRegion={quiet ? 'polite' : 'none'}
          onPress={onMeshPress}
          style={({ pressed }) => [styles.cell, styles.mesh, pressed && styles.pressed]}
        >
          <View
            testID="mesh-dot"
            style={[styles.dot, { backgroundColor: theme.colors[MESH_TONE_COLOR[status.tone]] }]}
          />
          <View style={styles.meshTexts}>
            <Text style={[styles.meshTitle, quiet && styles.quietText]}>{status.title}</Text>
            {status.detail ? <Text style={styles.meshDetail}>{status.detail}</Text> : null}
          </View>
        </Pressable>
      </View>
      {quiet ? (
        // Mesh down: gold on the warning wash, so nobody mistakes old positions for live ones.
        <View style={styles.quietRow}>
          <Text style={styles.quietDetail}>{MESH_QUIET_DETAIL}</Text>
        </View>
      ) : null}
      <ReadoutStrip readout={readout} updated={weatherUpdated} />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  plate: {
    backgroundColor: theme.colors.plate,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: 'hidden',
  },
  who: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  cell: {
    minHeight: sizes.minTapTarget + spacing.xs / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
  },
  group: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: '50%' },
  mesh: {
    flexShrink: 1,
    borderLeftWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  pressed: { backgroundColor: theme.colors.raised },
  groupText: { ...textStyles.label, color: theme.colors.text, flexShrink: 1 },
  dot: { width: sizes.meshDot, height: sizes.meshDot, borderRadius: radii.full },
  meshTexts: { flexShrink: 1 },
  meshTitle: { ...textStyles.markerName, color: theme.colors.text },
  meshDetail: { ...textStyles.markerDetail, color: theme.colors.textSecondary },
  quietText: { color: theme.colors.warning },
  quietRow: {
    backgroundColor: theme.colors.warningTint,
    borderBottomWidth: 1,
    borderColor: theme.colors.warning,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm,
  },
  quietDetail: { ...textStyles.body, color: theme.colors.warning },
}));
