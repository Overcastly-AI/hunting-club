import { mapChrome } from '@huntclub/design';
import { OVERDUE_ALERT_LABEL, type ConditionsReadout, type Wording } from '@huntclub/shared';
import { ChevronDown, ChevronUp, Users } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ICON_SIZE, makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../../theme';
import { MESH_QUIET_DETAIL, MESH_TONE_COLOR, describeMeshStatus } from '../meshStatus';
import type { MeshStatus } from '../types';
import { ReadoutStrip } from './ReadoutStrip';

/** The pill's spoken hint, and the card's Party link. */
export const PILL_HINT = 'Shows sunrise, sunset, wind, temperature and the mesh';
export const PARTY_LINK = 'Party and club';

type Props = {
  /** The club's name, or "Party" for free users. */
  groupLabel: string;
  mesh: MeshStatus;
  now: number;
  /** The one next time: "2 h 14 min until sunset", or "Overdue at 5:08 PM" while checked in. */
  next: Wording;
  readout: ConditionsReadout;
  /** "Updated 3 hr ago" once the forecast is old. */
  weatherUpdated?: Wording | null;
  /** While checked in: when the overdue alert goes out, if the phone knows. */
  overdueAt?: Wording | null;
  open: boolean;
  onToggle: () => void;
  onParty: () => void;
};

/**
 * The one top pill (docs/DESIGN.md "Map chrome" 2): the mesh status dot, the club or party and
 * the next time, 48 px tall and at most 300 wide. A quiet mesh turns the dot gold; there is no
 * banner. A tap drops the card under it: sunrise, sunset, wind and temperature, the overdue
 * time, the mesh in words and the Party link. Sunrise and sunset only, never shooting hours.
 */
export function MapPill(props: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const status = describeMeshStatus(props.mesh, props.now);
  const quiet = status.tone === 'quiet';
  const Chevron = props.open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.column} pointerEvents="box-none">
      <Pressable
        testID="map-pill"
        accessibilityRole="button"
        accessibilityLabel={`${props.groupLabel}. ${props.next.spoken}. ${status.text}`}
        accessibilityHint={PILL_HINT}
        accessibilityState={{ expanded: props.open }}
        accessibilityLiveRegion={quiet ? 'polite' : 'none'}
        onPress={props.onToggle}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <View
          testID="mesh-dot"
          style={[styles.dot, { backgroundColor: theme.colors[MESH_TONE_COLOR[status.tone]] }]}
        />
        <View style={styles.texts}>
          <Text style={styles.name}>{props.groupLabel}</Text>
          <Text style={styles.next}>{props.next.short}</Text>
        </View>
        <Chevron
          size={ICON_SIZE.sm}
          color={theme.colors.textSecondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>
      {props.open ? (
        <View testID="map-pill-card" style={styles.card}>
          <ReadoutStrip readout={props.readout} updated={props.weatherUpdated} />
          {props.overdueAt ? (
            <View
              accessible
              accessibilityLabel={`${OVERDUE_ALERT_LABEL} ${props.overdueAt.spoken}`}
              style={styles.row}
            >
              <Text style={styles.rowLabel}>{OVERDUE_ALERT_LABEL}</Text>
              <Text style={styles.rowValue}>{props.overdueAt.short}</Text>
            </View>
          ) : null}
          <View accessible style={styles.row}>
            <View
              style={[styles.dot, { backgroundColor: theme.colors[MESH_TONE_COLOR[status.tone]] }]}
            />
            <View style={styles.texts}>
              <Text style={[styles.rowValue, quiet && styles.quiet]}>{status.text}</Text>
              {quiet ? <Text style={styles.rowLabel}>{MESH_QUIET_DETAIL}</Text> : null}
            </View>
          </View>
          <View style={styles.link}>
            <Button icon={Users} label={PARTY_LINK} onPress={props.onParty} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  column: { alignItems: 'flex-start', gap: spacing.sm },
  pill: {
    minHeight: mapChrome.pill.height,
    maxWidth: mapChrome.pill.maxWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.plate,
  },
  pressed: { backgroundColor: theme.colors.raised },
  dot: { width: sizes.meshDot, height: sizes.meshDot, borderRadius: radii.full },
  texts: { flexShrink: 1 },
  name: { ...textStyles.markerName, color: theme.colors.text },
  next: { ...textStyles.markerDetail, color: theme.colors.textSecondary },
  // The card drops from the pill: hairline-divided rows, not a stack of cards.
  card: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.plate,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    minHeight: sizes.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  rowLabel: { ...textStyles.caption, color: theme.colors.textSecondary },
  rowValue: { ...textStyles.label, color: theme.colors.text },
  quiet: { color: theme.colors.warning },
  link: {
    padding: spacing.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
}));
