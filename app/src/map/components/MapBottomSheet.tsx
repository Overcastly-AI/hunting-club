import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { colors, opacity, radii, sizes, spacing, textStyles } from '../../theme';
import { describeAge, elapsedMs } from '../../domain/time';
import { placeLabel } from '../labels';
import type { HunterPlace } from '../types';

export type HelpAudience = 'party' | 'club';

/** Who Ask for a Hand reaches. Never worded or styled like an emergency call. */
export const HELP_AUDIENCE_TEXT: Record<HelpAudience, string> = {
  party: 'Pings your party',
  club: 'Pings club members',
};

export type MapBottomSheetProps =
  | {
      state: 'checkedIn';
      place: HunterPlace;
      checkedInAt: number;
      now: number;
      audience: HelpAudience;
      onAskForHand: () => void;
      onCheckOut: () => void;
      onChangeMode: () => void;
      onLogHarvest: () => void;
    }
  | {
      state: 'notCheckedIn';
      /** Club: the nearest open stand, suggested on the button. */
      suggestion?: string;
      onCheckIn: () => void;
    };

/** The bottom sheet's two states from the spec: checked in, and not checked in. */
export function MapBottomSheet(props: MapBottomSheetProps) {
  return (
    <View style={styles.sheet}>
      {props.state === 'checkedIn' ? <CheckedIn {...props} /> : <NotCheckedIn {...props} />}
    </View>
  );
}

function NotCheckedIn({
  suggestion,
  onCheckIn,
}: Extract<MapBottomSheetProps, { state: 'notCheckedIn' }>) {
  return (
    <Button
      variant="primary"
      label="Check In"
      detail={suggestion ? `Nearest open: ${suggestion}` : undefined}
      onPress={onCheckIn}
    />
  );
}

function CheckedIn(props: Extract<MapBottomSheetProps, { state: 'checkedIn' }>) {
  const since = describeAge(elapsedMs(props.checkedInAt, props.now)).short;
  return (
    <>
      <View accessible accessibilityRole="header">
        <Text style={styles.overline}>
          {props.place.kind === 'moving' ? 'Checked in' : 'Checked in at'}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {placeLabel(props.place)}
        </Text>
        <Text style={styles.since}>Checked in {since === 'Just now' ? 'just now' : since}</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            variant="help"
            label="Ask for a Hand"
            detail={HELP_AUDIENCE_TEXT[props.audience]}
            onPress={props.onAskForHand}
          />
        </View>
        <View style={styles.flex}>
          <Button variant="primary" label="Check Out" onPress={props.onCheckOut} />
        </View>
      </View>
      <Button label="Change mode" onPress={props.onChangeMode} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log a harvest. Private"
        onPress={props.onLogHarvest}
        style={({ pressed }) => [styles.harvestRow, pressed && { opacity: opacity.pressed }]}
      >
        <Text style={styles.harvestText}>Log a harvest</Text>
        <Text style={styles.harvestDetail}>Private</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    padding: spacing.md,
    gap: spacing.sm,
  },
  overline: { ...textStyles.body, color: colors.textSecondary },
  title: { ...textStyles.sheetTitle, color: colors.text },
  since: { ...textStyles.body, color: colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  harvestRow: {
    minHeight: sizes.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  harvestText: { ...textStyles.label, color: colors.text },
  harvestDetail: { ...textStyles.body, color: colors.textSecondary },
});
