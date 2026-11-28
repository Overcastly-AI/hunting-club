import { useSQLiteContext } from 'expo-sqlite';
import { useContext, useState } from 'react';
import { Text, View } from 'react-native';

import { Crosshair, Lock, NotebookPen, Share2, Users } from 'lucide-react-native';

import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { HARVEST_SEX_LABELS, formatClockTime, formatShortDate } from '@huntclub/shared';
import { makeStyles, spacing, textStyles } from '../theme';
import { SHARE_LABELS } from './form';
import { HarvestRadioContext, shareHarvest } from './HarvestRadio';
import { HarvestSheet } from './HarvestSheet';
import type { LocalHarvest } from './harvests';
import { harvestsChanged, useHarvests } from './useHarvests';

/** One line about a harvest: "Deer · Male · Creek Stand · Nov 30, 6:52 AM". */
export function harvestSummary(h: LocalHarvest): string {
  const when = new Date(h.harvestedAt);
  return [
    h.species,
    HARVEST_SEX_LABELS[h.sex],
    h.placeLabel,
    `${formatShortDate(when)}, ${formatClockTime(when)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** My harvests (Club tab): private unless shared, with a share button for private ones. */
export function HarvestList() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const radio = useContext(HarvestRadioContext);
  const harvests = useHarvests();
  const [logging, setLogging] = useState(false);

  const share = async (h: LocalHarvest) => {
    if (radio && (await shareHarvest(radio, db, h, 'party'))) harvestsChanged();
  };

  const logButton = (
    <Button
      icon={NotebookPen}
      label="Log a harvest"
      detail="Private unless you share it"
      onPress={() => setLogging(true)}
    />
  );

  return (
    <Card title="My harvests">
      {harvests.length === 0 ? (
        <EmptyState icon={Crosshair} title="No harvests logged yet" action={logButton}>
          Log a harvest when you take one. It stays on this phone until you share it.
        </EmptyState>
      ) : (
        logButton
      )}
      {harvests.map((h) => (
        <View key={h.id} style={styles.row}>
          <Text style={styles.summary}>{harvestSummary(h)}</Text>
          {h.sharedWith === 'none' ? (
            <Badge tone="neutral" icon={Lock} label={SHARE_LABELS.none} />
          ) : (
            <Badge
              tone="info"
              icon={Users}
              label={`Shared with ${SHARE_LABELS[h.sharedWith].toLowerCase()}`}
            />
          )}
          {h.sharedWith === 'none' && radio ? (
            <Button icon={Share2} label="Share with party" onPress={() => void share(h)} />
          ) : null}
        </View>
      ))}
      <HarvestSheet visible={logging} onClose={() => setLogging(false)} />
    </Card>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingTop: spacing.md,
  },
  summary: { ...textStyles.bodyLarge, color: theme.colors.text },
}));
