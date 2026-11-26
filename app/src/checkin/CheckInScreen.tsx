import { CORE_CONFIG } from '@huntclub/core';
import { CheckInMode, type LatLon } from '@huntclub/mesh';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Choice } from '../components/Choice';
import { SlideToConfirm } from '../components/SlideToConfirm';
import { TextField } from '../components/TextField';
import { placeLabel } from '../map/labels';
import { useNow } from '../hooks/useNow';
import { placeOf } from '../map/place';
import { ensureLocationPermission } from '../permissions/location';
import { makeStyles, spacing, textStyles } from '../theme';
import { useCheckInActions, useCheckInState } from './CheckInRadio';
import { SLIDE_TO_CHECK_OUT } from './CheckOutSheet';
import { checkInChoices } from './modes';
import { overdueNote } from './overdueNote';
import { placementFrom, sortStands, type CheckInDraft } from './placement';
import { SendStatusText } from './SendStatusText';

const NO_RADIO =
  'Connect your radio to check in. Check-ins travel over the radio so your party can see you.';

/** Check In tab: pick how you're hunting, then slide to check in (or change mode, or check out). */
export function CheckInScreen() {
  const styles = useStyles();
  const { radio, current } = useCheckInState();
  const now = useNow();
  const { checkIn, checkOut, status } = useCheckInActions(radio);
  const [draft, setDraft] = useState<CheckInDraft>({ mode: CheckInMode.Spot });
  const [locating, setLocating] = useState(false);
  const [pin, setPin] = useState<LatLon | undefined>();

  const club = radio?.audience === 'club' ? radio.club : undefined;
  const choices = checkInChoices(!!club);
  const result = placementFrom({ ...draft, pin });
  const changing = current !== null;

  const choose = async (mode: CheckInMode) => {
    setDraft((d) => ({ ...d, mode }));
    if (mode === CheckInMode.Spot && !pin) {
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {current ? (
          <View accessible accessibilityRole="header">
            <Text style={styles.overline}>Checked in at</Text>
            <Text style={styles.title}>{placeLabel(placeOf(current.placement))}</Text>
          </View>
        ) : (
          <Text accessibilityRole="header" style={styles.title}>
            Check In
          </Text>
        )}

        <Text accessibilityRole="header" style={styles.heading}>
          {changing ? 'Change mode' : 'How are you hunting?'}
        </Text>
        <View accessibilityRole="radiogroup" style={styles.group}>
          {choices.map((choice) => (
            <Choice
              key={choice.mode}
              label={choice.label}
              detail={choice.detail}
              selected={draft.mode === choice.mode}
              onPress={() => void choose(choice.mode)}
            />
          ))}
        </View>

        {draft.mode === CheckInMode.Spot ? (
          <TextField
            placeholder="Name this spot (optional)"
            value={draft.spotName ?? ''}
            onChangeText={(spotName) => setDraft((d) => ({ ...d, spotName }))}
            maxLength={24}
          />
        ) : null}

        {club && draft.mode === CheckInMode.Stand ? (
          <View accessibilityRole="radiogroup" style={styles.group}>
            {sortStands(club.stands, pin).map((stand, index) => (
              <Choice
                key={stand.meshId}
                label={stand.name}
                detail={
                  stand.occupiedBy
                    ? `${stand.occupiedBy} is here`
                    : index === 0
                      ? 'Nearest open stand'
                      : 'Open'
                }
                selected={draft.standId === stand.meshId}
                disabled={!!stand.occupiedBy}
                onPress={() => setDraft((d) => ({ ...d, standId: stand.meshId }))}
              />
            ))}
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

        <Text style={styles.note}>
          {overdueNote(
            current?.checkedInAt ?? now,
            pin,
            radio?.graceMinutes ?? CORE_CONFIG.overdue.graceMinutes,
            radio?.audience ?? 'party',
          )}
        </Text>

        <SlideToConfirm
          label={changing ? 'Slide to change mode' : 'Slide to check in'}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.surface0 },
  content: { padding: spacing.md, gap: spacing.md },
  overline: { ...textStyles.body, color: theme.colors.textSecondary },
  title: { ...textStyles.sheetTitle, color: theme.colors.text },
  heading: { ...textStyles.label, color: theme.colors.text },
  group: { gap: spacing.sm },
  note: { ...textStyles.body, color: theme.colors.textSecondary },
}));
