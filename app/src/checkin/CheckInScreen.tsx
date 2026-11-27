import { CORE_CONFIG } from '@huntclub/core';
import { CheckInMode, type LatLon } from '@huntclub/mesh';
import { Footprints, MapPin, Pentagon, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Choice } from '../components/Choice';
import { Field } from '../components/Field';
import { STAND_ICON_COMPONENTS } from '../components/icons';
import { SlideToConfirm } from '../components/SlideToConfirm';
import { useNow } from '../hooks/useNow';
import { MapStrip } from '../map/components/MapStrip';
import { placeLabel } from '../map/labels';
import { placeOf } from '../map/place';
import { ensureLocationPermission } from '../permissions/location';
import { makeStyles, radii, sizes, spacing, textStyles } from '../theme';
import { useCheckInActions, useCheckInState } from './CheckInRadio';
import { SLIDE_TO_CHECK_OUT } from './CheckOutSheet';
import { checkInChoices } from './modes';
import { overdueNote } from './overdueNote';
import { placementFrom, type CheckInDraft } from './placement';
import { SendStatusText } from './SendStatusText';
import { STANDS_NEAREST_FIRST, StandList } from './StandList';

const NO_RADIO =
  'Connect your radio to check in. Check-ins travel over the radio so your party can see you.';

/** The title over the modes, before you check in. */
export const WHERE_ARE_YOU_HUNTING = 'Where are you hunting?';

/** Each mode's icon: a ladder stand, an area's outline, a pin, footprints. */
export const MODE_ICONS: Record<CheckInMode, LucideIcon> = {
  [CheckInMode.Stand]: STAND_ICON_COMPONENTS.ArrowUpFromLine,
  [CheckInMode.Area]: Pentagon,
  [CheckInMode.Spot]: MapPin,
  [CheckInMode.Moving]: Footprints,
};

/** Modes that need to know where you are before the slider is ready (or to sort stands). */
const LOCATES: readonly CheckInMode[] = [CheckInMode.Spot, CheckInMode.Stand];

/**
 * "Slide to check in at Oak Ridge" once a place is picked, else "Slide to check in";
 * "Slide to change mode" while checked in.
 */
export function slideLabel(changing: boolean, place: string | null): string {
  if (changing) return 'Slide to change mode';
  return place ? `Slide to check in at ${place}` : 'Slide to check in';
}

/**
 * Check In tab (docs/DESIGN.md, Check In): a peek of the map, then where you are hunting (at a
 * stand, in an area, right here or on the move), the club's stands nearest first, when an
 * overdue alert would go out, and the slider. Stands are optional: every mode works without one.
 */
export function CheckInScreen() {
  const styles = useStyles();
  const { radio, current } = useCheckInState();
  const now = useNow();
  const { checkIn, checkOut, status } = useCheckInActions(radio);
  const club = radio?.audience === 'club' ? radio.club : undefined;
  const choices = checkInChoices(!!club);
  const [draft, setDraft] = useState<CheckInDraft>({ mode: choices[0]!.mode });
  const [locating, setLocating] = useState(false);
  const [pin, setPin] = useState<LatLon | undefined>();

  const result = placementFrom({ ...draft, pin });
  const changing = current !== null;
  const chosen = choices.find((choice) => choice.mode === draft.mode);

  const choose = async (mode: CheckInMode) => {
    setDraft((d) => ({ ...d, mode }));
    if (LOCATES.includes(mode) && !pin) {
      setLocating(true);
      setPin((await ensureLocationPermission()) ?? undefined);
      setLocating(false);
    }
  };

  const missing = !radio
    ? NO_RADIO
    : !result.ok
      ? locating
        ? 'Getting your location…'
        : result.missing
      : undefined;
  const picked = result.ok && draft.mode !== CheckInMode.Moving ? result.placement : null;
  const pickedName =
    picked && club
      ? picked.mode === CheckInMode.Stand
        ? club.stands.find((s) => s.meshId === picked.standId)?.name
        : picked.mode === CheckInMode.Area
          ? club.areas.find((a) => a.meshId === picked.areaId)?.name
          : undefined
      : undefined;
  const note = overdueNote(
    current?.checkedInAt ?? now,
    pin,
    radio?.graceMinutes ?? CORE_CONFIG.overdue.graceMinutes,
    radio?.audience ?? 'party',
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <MapStrip height={sizes.checkInMapPeek} />
        <View style={styles.panel}>
          {current ? (
            <View accessible accessibilityRole="header">
              <Text style={styles.overline}>Checked in at</Text>
              <Text style={styles.title}>{placeLabel(placeOf(current.placement))}</Text>
            </View>
          ) : (
            <Text accessibilityRole="header" style={styles.title}>
              {WHERE_ARE_YOU_HUNTING}
            </Text>
          )}
          {changing ? (
            <Text accessibilityRole="header" style={styles.heading}>
              Change mode
            </Text>
          ) : null}

          <View accessibilityRole="radiogroup" style={styles.modes}>
            {choices.map((choice) => (
              <View key={choice.mode} style={styles.mode}>
                <Choice
                  look="tile"
                  icon={MODE_ICONS[choice.mode]}
                  label={choice.label}
                  detail={choice.detail}
                  selected={draft.mode === choice.mode}
                  onPress={() => void choose(choice.mode)}
                />
              </View>
            ))}
          </View>
          {chosen ? <Text style={styles.modeDetail}>{chosen.detail}</Text> : null}

          {draft.mode === CheckInMode.Spot ? (
            <Field
              label="Name this spot (optional)"
              value={draft.spotName ?? ''}
              onChangeText={(spotName) => setDraft((d) => ({ ...d, spotName }))}
              maxLength={24}
            />
          ) : null}

          {club && draft.mode === CheckInMode.Stand ? (
            <View>
              <Text accessibilityRole="header" style={styles.heading}>
                {STANDS_NEAREST_FIRST}
              </Text>
              <StandList
                stands={club.stands}
                here={pin}
                chosen={draft.standId}
                onChoose={(standId) => setDraft((d) => ({ ...d, standId }))}
              />
            </View>
          ) : null}

          {club && draft.mode === CheckInMode.Area ? (
            <View accessibilityRole="radiogroup" style={styles.group}>
              {club.areas.map((area) => (
                <Choice
                  key={area.meshId}
                  label={area.name}
                  selected={draft.areaId === area.meshId}
                  onPress={() => setDraft((d) => ({ ...d, areaId: area.meshId }))}
                />
              ))}
            </View>
          ) : null}

          <OverdueLine text={note.text} time={note.time} />

          <SlideToConfirm
            label={slideLabel(changing, pickedName ?? null)}
            onConfirm={() => {
              if (result.ok) checkIn(result.placement);
            }}
            disabled={!!missing}
            disabledReason={missing}
          />
          {current ? (
            <SlideToConfirm
              label={SLIDE_TO_CHECK_OUT}
              onConfirm={() => void checkOut()}
              disabled={!radio}
            />
          ) : null}
          <SendStatusText status={status} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The overdue line, its clock time in ink. */
function OverdueLine({ text, time }: { text: string; time: string | null }) {
  const styles = useStyles();
  const [before, after] = time ? text.split(time) : [text, undefined];
  return (
    <Text style={styles.note}>
      {before}
      {time ? <Text style={styles.noteTime}>{time}</Text> : null}
      {after ?? null}
    </Text>
  );
}

const useStyles = makeStyles((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.canvas },
  scroll: { flexGrow: 1 },
  // The panel rises over the peek of map like a sheet.
  panel: {
    flexGrow: 1,
    marginTop: -spacing.md,
    backgroundColor: theme.colors.plate,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
  overline: { ...textStyles.body, color: theme.colors.textSecondary },
  title: { ...textStyles.sheetTitle, color: theme.colors.text },
  heading: { ...textStyles.label, color: theme.colors.text, paddingVertical: spacing.xs },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Two modes to a row.
  mode: { flexGrow: 1, flexBasis: '40%' },
  modeDetail: { ...textStyles.body, color: theme.colors.textSecondary },
  group: { gap: spacing.sm },
  note: {
    ...textStyles.body,
    color: theme.colors.textSecondary,
    paddingTop: spacing.sm + spacing.xs / 2,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  noteTime: { ...textStyles.label, color: theme.colors.text },
}));
