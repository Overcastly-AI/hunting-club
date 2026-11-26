import { useSQLiteContext } from 'expo-sqlite';
import { useContext, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { formatClockTime } from '../conditions/clock';
import { colors, spacing, textStyles } from '../theme';
import { SEX_LABELS, SHARE_LABELS } from './form';
import { HarvestRadioContext, shareHarvest } from './HarvestRadio';
import { HarvestSheet } from './HarvestSheet';
import type { LocalHarvest } from './harvests';
import { harvestsChanged, useHarvests } from './useHarvests';

/** One line about a harvest: "Deer · Male · Creek Stand · Nov 30, 6:52 AM". */
export function harvestSummary(h: LocalHarvest): string {
  const when = new Date(h.harvestedAt);
  const date = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return [h.species, SEX_LABELS[h.sex], h.placeLabel, `${date}, ${formatClockTime(when)}`]
    .filter(Boolean)
    .join(' · ');
}

/** My harvests (Party/Club tab): private unless shared, with a share button for private ones. */
export function HarvestList() {
  const db = useSQLiteContext();
  const radio = useContext(HarvestRadioContext);
  const harvests = useHarvests();
  const [logging, setLogging] = useState(false);

  const share = async (h: LocalHarvest) => {
    if (radio && (await shareHarvest(radio, db, h, 'party'))) harvestsChanged();
  };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        My harvests
      </Text>
      <Button
        label="Log a harvest"
        detail="Private unless you share it"
        onPress={() => setLogging(true)}
      />
      {harvests.length === 0 ? <Text style={styles.body}>No harvests logged yet.</Text> : null}
      {harvests.map((h) => (
        <View key={h.id} style={styles.row}>
          <Text style={styles.summary}>{harvestSummary(h)}</Text>
          <Text style={styles.body}>
            {h.sharedWith === 'none'
              ? SHARE_LABELS.none
              : `Shared with ${SHARE_LABELS[h.sharedWith].toLowerCase()}`}
          </Text>
          {h.sharedWith === 'none' && radio ? (
            <Button label="Share with party" onPress={() => void share(h)} />
          ) : null}
        </View>
      ))}
      <HarvestSheet visible={logging} onClose={() => setLogging(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...textStyles.label, color: colors.text },
  row: { gap: spacing.xs, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm },
  summary: { ...textStyles.bodyLarge, color: colors.text },
  body: { ...textStyles.body, color: colors.textSecondary },
});
