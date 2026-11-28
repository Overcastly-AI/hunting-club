import type { SheetDetent } from '@huntclub/design';
import { describeAge, positionAge } from '@huntclub/shared';
import { Hand, MapPin, NotebookPen, Repeat2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { StandSquare } from '../../components/StandSquare';
import { HELP_AUDIENCE_TEXT, type Audience } from '../../domain/audience';
import { ASK_FOR_A_HAND } from '../../safety/wording';
import { makeStyles, sizes, spacing, textStyles } from '../../theme';
import { hunterPlateDetail, placeLabel } from '../labels';
import type { HunterOnMap, HunterPlace } from '../types';
import type { ClubStand } from '../../checkin/placement';
import { DetentSheet } from './DetentSheet';

/** What the sheet says before you check in: nobody sees your location until you do. */
export const NOT_CHECKED_IN = 'Not checked in';
export const NOBODY_SEES_YOU = 'Nobody can see you yet.';
export const OUT_NOW = 'Out now';

/** The nearest open stand, and how far, for the half sheet. */
export type NearestStand = { stand: ClubStand; distance: string | null };

type Common = {
  mapTop: number;
  mapHeight: number;
  /** The club's name (or Party): the full sheet's header, beside the collapse button. */
  title: string;
  detent: SheetDetent;
  onDetent: (detent: SheetDetent) => void;
  reduceMotion: boolean;
  /** Who Ask for a Hand pings: your party or your club. */
  audience: Audience;
  onAskForHand: () => void;
  onLogHarvest: () => void;
  /** Club: the nearest open stand; a tap shows it on the map. Stands are optional. */
  nearestStand: NearestStand | null;
  onShowStand: (stand: ClubStand) => void;
  /** Everyone out, for the full sheet. */
  hunters: readonly HunterOnMap[];
  now: number;
};

export type MapBottomSheetProps = Common &
  (
    | {
        state: 'checkedIn';
        place: HunterPlace;
        checkedInAt: number;
        onCheckOut: () => void;
        onChangeSpot: () => void;
      }
    | { state: 'notCheckedIn'; onCheckIn: () => void }
  );

/**
 * The map's one bottom sheet (docs/DESIGN.md "Map chrome" 4). Peek: one status line, then
 * Check In (or Check Out) and the 56 by 56 Ask for a Hand. Half: change spot, log a harvest,
 * the nearest stand. Full: everyone out. Stands are optional: every state works at a spot or
 * on the move. The sunset time is in the top pill, not here.
 */
export function MapBottomSheet(props: MapBottomSheetProps) {
  const styles = useStyles();
  const checkedIn = props.state === 'checkedIn';
  const status = checkedIn
    ? checkedInStatus(props)
    : { title: NOT_CHECKED_IN, rest: NOBODY_SEES_YOU };
  return (
    <DetentSheet
      testID="map-chrome-sheet"
      mapTop={props.mapTop}
      mapHeight={props.mapHeight}
      title={props.title}
      detent={props.detent}
      onDetent={props.onDetent}
      reduceMotion={props.reduceMotion}
      statusSpoken={`${status.title}. ${status.rest}`}
      status={
        <Text style={styles.status}>
          <Text style={styles.statusTitle}>{status.title}</Text> {status.rest}
        </Text>
      }
      actions={
        <>
          <View style={styles.main}>
            {checkedIn ? (
              <Button variant="primary" size="sheet" label="Check Out" onPress={props.onCheckOut} />
            ) : (
              <Button
                variant="primary"
                size="sheet"
                icon={MapPin}
                label="Check In"
                onPress={props.onCheckIn}
              />
            )}
          </View>
          {/* Gold, a hand, and who it pings. Never red, never worded like an emergency. */}
          <Button
            variant="help"
            size="sheet"
            iconOnly
            icon={Hand}
            label={ASK_FOR_A_HAND}
            detail={HELP_AUDIENCE_TEXT[props.audience]}
            onPress={props.onAskForHand}
          />
        </>
      }
    >
      {checkedIn ? (
        <Button icon={Repeat2} label="Change spot" onPress={props.onChangeSpot} />
      ) : null}
      <Button
        icon={NotebookPen}
        label="Log a harvest"
        detail="Private"
        onPress={props.onLogHarvest}
      />
      {props.nearestStand ? (
        <NearestStandRow nearest={props.nearestStand} onPress={props.onShowStand} />
      ) : null}
      <OutNow hunters={props.hunters} now={props.now} />
    </DetentSheet>
  );
}

function checkedInStatus(p: Extract<MapBottomSheetProps, { state: 'checkedIn' }>) {
  const since = describeAge(positionAge(p.checkedInAt, p.now)).short;
  const where = p.place.kind === 'moving' ? placeLabel(p.place) : `at ${placeLabel(p.place)}`;
  return {
    title: 'Checked in',
    rest: `${where}, since ${since === 'Just now' ? 'just now' : since}`,
  };
}

/** "Nearest stand", the stand's square, its name and how far: a tap shows it on the map. */
function NearestStandRow({
  nearest,
  onPress,
}: {
  nearest: NearestStand;
  onPress: (stand: ClubStand) => void;
}) {
  const styles = useStyles();
  const { stand, distance } = nearest;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Nearest stand: ${stand.name}${distance ? `, ${distance} away` : ''}`}
      accessibilityHint="Shows it on the map"
      onPress={() => onPress(stand)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <StandSquare type={stand.type} />
      <View style={styles.texts}>
        <Text style={styles.rowDetail}>Nearest stand</Text>
        <Text style={styles.rowTitle}>{stand.name}</Text>
      </View>
      {distance ? <Text style={styles.distance}>{distance}</Text> : null}
    </Pressable>
  );
}

/** Everyone out: name, where, and how long ago their radio was heard. */
function OutNow({ hunters, now }: { hunters: readonly HunterOnMap[]; now: number }) {
  const styles = useStyles();
  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        {OUT_NOW}
      </Text>
      {hunters.length === 0 ? (
        <Text style={styles.rowDetail}>Nobody else is checked in.</Text>
      ) : (
        hunters.map((hunter) => (
          <View key={hunter.id} accessible style={styles.row}>
            <View style={styles.texts}>
              <Text style={styles.rowTitle}>{placeLabel(hunter.place)}</Text>
              <Text style={styles.rowDetail}>{hunterPlateDetail(hunter, now)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  status: { ...textStyles.body, color: theme.colors.textSecondary },
  statusTitle: { ...textStyles.label, color: theme.colors.text },
  main: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  heading: { ...textStyles.label, color: theme.colors.text, paddingVertical: spacing.xs },
  row: {
    minHeight: sizes.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.xs / 2,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  pressed: { backgroundColor: theme.colors.raised },
  texts: { flex: 1 },
  rowTitle: { ...textStyles.label, color: theme.colors.text },
  rowDetail: { ...textStyles.caption, color: theme.colors.textSecondary },
  distance: { ...textStyles.readoutInline, color: theme.colors.text },
}));
