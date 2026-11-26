import { HARVEST_SEXES } from '@huntclub/shared';
import { useSQLiteContext } from 'expo-sqlite';
import { useContext, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useCheckInState } from '../checkin/CheckInRadio';
import { Button } from '../components/Button';
import { OptionButtons } from '../components/OptionButtons';
import { SegmentedControl } from '../components/SegmentedControl';
import { Sheet } from '../components/Sheet';
import { TextField } from '../components/TextField';
import { colors, textStyles } from '../theme';
import {
  COMMON_SPECIES,
  EMPTY_DRAFT,
  SEX_LABELS,
  SHARE_LABELS,
  draftProblem,
  harvestFromDraft,
  shareChoices,
} from './form';
import { HarvestRadioContext, shareHarvest } from './HarvestRadio';
import { insertHarvest, type SharedWith } from './harvests';
import { harvestsChanged } from './useHarvests';

type Props = { visible: boolean; onClose: () => void };

/** Log a harvest: private by default, saved on this phone; optionally shared over the radio. */
export function HarvestSheet({ visible, onClose }: Props) {
  const db = useSQLiteContext();
  const radio = useContext(HarvestRadioContext);
  const { current } = useCheckInState();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [status, setStatus] = useState<string | null>(null);
  const problem = draftProblem(draft);
  const choices = shareChoices(radio?.audience ?? 'party');
  const where = harvestFromDraft(draft, current, 0).placeLabel;

  const save = async () => {
    if (problem) return;
    const now = Date.now();
    const harvest = harvestFromDraft(draft, current, now);
    const id = await insertHarvest(db, harvest, now);
    let message = 'Saved on this phone. Only you can see it.';
    if (draft.share !== 'none' && radio) {
      const sent = await shareHarvest(radio, db, { ...harvest, id }, draft.share);
      message = sent
        ? `Saved and shared with your ${SHARE_LABELS[draft.share].toLowerCase()}.`
        : 'Saved. Sharing didn’t go out; try again from My harvests.';
    }
    harvestsChanged();
    setDraft(EMPTY_DRAFT);
    setStatus(message);
  };

  return (
    <Sheet visible={visible} title="Log a harvest" onClose={onClose}>
      <OptionButtons
        options={COMMON_SPECIES}
        selected={COMMON_SPECIES.find((s) => s === draft.species.trim())}
        onPress={(species) => setDraft((d) => ({ ...d, species }))}
      />
      <TextField
        placeholder="Species"
        value={draft.species}
        onChangeText={(species) => setDraft((d) => ({ ...d, species }))}
      />
      <SegmentedControl
        segments={HARVEST_SEXES}
        labels={SEX_LABELS}
        selected={draft.sex}
        onSelect={(sex) => setDraft((d) => ({ ...d, sex }))}
      />
      <Text style={styles.body}>
        {where ? `Where: ${where} (from your check-in)` : 'Where: not checked in'}
      </Text>
      <TextField
        placeholder="Notes (optional)"
        value={draft.notes}
        onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
        multiline
      />
      <SegmentedControl<SharedWith>
        segments={choices}
        labels={SHARE_LABELS}
        selected={draft.share}
        onSelect={(share) => setDraft((d) => ({ ...d, share }))}
      />
      <Text style={styles.body}>
        {draft.share === 'none'
          ? 'Private: only on this phone.'
          : radio
            ? `Sends species, sex and where to your ${SHARE_LABELS[draft.share].toLowerCase()}.`
            : 'Connect your radio to share. It will be saved as private.'}
      </Text>
      <Button
        variant="primary"
        label="Save harvest"
        onPress={() => void save()}
        disabled={!!problem}
        accessibilityHint={problem ?? undefined}
      />
      {problem && draft.species ? <Text style={styles.body}>{problem}</Text> : null}
      {status ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { ...textStyles.body, color: colors.textSecondary },
  status: { ...textStyles.body, color: colors.fresh },
});
