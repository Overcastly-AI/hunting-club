import { Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { HELP_AUDIENCE_TEXT, type Audience } from '../../domain/audience';
import { makeStyles, opacity, radii, sizes, spacing, textStyles } from '../../theme';
import { positionAge } from '@huntclub/core';

import { describeAge } from '../age';
import { placeLabel } from '../labels';
import type { HunterPlace } from '../types';

export type MapBottomSheetProps =
  | {
      state: 'checkedIn';
      place: HunterPlace;
      checkedInAt: number;
      now: number;
      audience: Audience;
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
  const styles = useStyles();
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
  const styles = useStyles();
  const since = describeAge(positionAge(props.checkedInAt, props.now)).short;
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

const useStyles = makeStyles((theme) => ({
  sheet: {
    backgroundColor: theme.colors.surface0,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    padding: spacing.md,
    gap: spacing.sm,
  },
  overline: { ...textStyles.body, color: theme.colors.textSecondary },
  title: { ...textStyles.sheetTitle, color: theme.colors.text },
  since: { ...textStyles.body, color: theme.colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  harvestRow: {
    minHeight: sizes.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  harvestText: { ...textStyles.label, color: theme.colors.text },
  harvestDetail: { ...textStyles.body, color: theme.colors.textSecondary },
}));
