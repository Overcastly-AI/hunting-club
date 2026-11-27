import { UNTIL_SUNSET, describeAge, positionAge, type UntilSunset } from '@huntclub/shared';
import { Hand, MapPin, NotebookPen, Repeat2 } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Grabber } from '../../components/Grabber';
import { Button } from '../../components/Button';
import { HELP_AUDIENCE_TEXT, type Audience } from '../../domain/audience';
import { makeStyles, radii, spacing, textStyles } from '../../theme';
import { placeLabel } from '../labels';
import type { HunterPlace } from '../types';

/** What the sheet says before you check in: nobody sees your location until you do. */
export const NOT_CHECKED_IN = 'Not checked in';
export const NOBODY_SEES_YOU = 'Nobody can see you yet.';

type Common = {
  /** "2 h 14 min until sunset"; null after sunset or before the phone knows where it is. */
  untilSunset: UntilSunset | null;
  /** Who Ask for a Hand pings: your party or your club. */
  audience: Audience;
  onAskForHand: () => void;
};

export type MapBottomSheetProps = Common &
  (
    | {
        state: 'checkedIn';
        place: HunterPlace;
        checkedInAt: number;
        now: number;
        onCheckOut: () => void;
        onChangeMode: () => void;
        onLogHarvest: () => void;
      }
    | {
        state: 'notCheckedIn';
        /** Club: the nearest open stand, suggested on the button. */
        suggestion?: string;
        onCheckIn: () => void;
      }
  );

/**
 * The map's bottom sheet (docs/DESIGN.md "Layout"): where you stand (not checked in, or
 * checked in and where), the time left until sunset, the main action and Ask for a Hand.
 * Stands are optional: checking in works at a spot or on the move.
 */
export function MapBottomSheet(props: MapBottomSheetProps) {
  const styles = useStyles();
  return (
    <View style={styles.sheet}>
      <Grabber />
      {props.state === 'checkedIn' ? <CheckedIn {...props} /> : <NotCheckedIn {...props} />}
    </View>
  );
}

/** "2 h 14 min" over "until sunset", at the right of the sheet's first row. */
function Countdown({ untilSunset }: { untilSunset: UntilSunset | null }) {
  const styles = useStyles();
  if (!untilSunset) return null;
  return (
    <View accessible accessibilityLabel={untilSunset.spoken} style={styles.countdown}>
      <Text style={styles.span}>{untilSunset.span}</Text>
      <Text style={styles.spanLabel}>{UNTIL_SUNSET}</Text>
    </View>
  );
}

/** Ask for a Hand: gold, a hand, and who it pings. Never red, never worded like an emergency. */
function AskForHandButton({ audience, onAskForHand }: Common) {
  return (
    <Button
      variant="help"
      size="hero"
      icon={Hand}
      label="Ask for a Hand"
      detail={HELP_AUDIENCE_TEXT[audience]}
      onPress={onAskForHand}
    />
  );
}

function NotCheckedIn(props: Extract<MapBottomSheetProps, { state: 'notCheckedIn' }>) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.state}>
        <View accessible accessibilityRole="header" style={styles.flex}>
          <Text style={styles.title}>{NOT_CHECKED_IN}</Text>
          <Text style={styles.subtitle}>{NOBODY_SEES_YOU}</Text>
        </View>
        <Countdown untilSunset={props.untilSunset} />
      </View>
      <View style={styles.actions}>
        <View style={styles.main}>
          <Button
            variant="primary"
            size="lg"
            icon={MapPin}
            label="Check In"
            detail={props.suggestion ? `Nearest open: ${props.suggestion}` : undefined}
            onPress={props.onCheckIn}
          />
        </View>
        <View style={styles.flex}>
          <AskForHandButton {...props} />
        </View>
      </View>
    </>
  );
}

function CheckedIn(props: Extract<MapBottomSheetProps, { state: 'checkedIn' }>) {
  const styles = useStyles();
  const since = describeAge(positionAge(props.checkedInAt, props.now)).short;
  return (
    <>
      <View style={styles.state}>
        <View accessible accessibilityRole="header" style={styles.flex}>
          <Text style={styles.subtitle}>
            {props.place.kind === 'moving' ? 'Checked in' : 'Checked in at'}
          </Text>
          {/* Wraps rather than cutting off a long place name at large text sizes. */}
          <Text style={styles.title}>{placeLabel(props.place)}</Text>
          <Text style={styles.subtitle}>Since {since === 'Just now' ? 'just now' : since}</Text>
        </View>
        <Countdown untilSunset={props.untilSunset} />
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <AskForHandButton {...props} />
        </View>
        <View style={styles.flex}>
          <Button variant="primary" size="hero" label="Check Out" onPress={props.onCheckOut} />
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button icon={Repeat2} label="Change mode" onPress={props.onChangeMode} />
        </View>
        <View style={styles.flex}>
          <Button
            variant="tertiary"
            icon={NotebookPen}
            label="Log a harvest"
            detail="Private"
            onPress={props.onLogHarvest}
          />
        </View>
      </View>
    </>
  );
}

const useStyles = makeStyles((theme) => ({
  sheet: {
    backgroundColor: theme.colors.plate,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingBottom: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  state: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.xs / 2,
  },
  flex: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  // Check In takes a little more of the row than Ask for a Hand, as in the design.
  main: { flexGrow: 1.08, flexShrink: 1, flexBasis: 0 },
  title: { ...textStyles.title2, color: theme.colors.text },
  subtitle: { ...textStyles.body, color: theme.colors.textSecondary },
  countdown: { alignItems: 'flex-end' },
  span: { ...textStyles.readout, color: theme.colors.text },
  spanLabel: { ...textStyles.caption, color: theme.colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm + spacing.xs / 2 },
}));
