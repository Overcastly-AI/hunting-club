import type { LatLon } from '@huntclub/mesh';
import { STAND_TYPE_LABELS } from '@huntclub/shared';
import { Pressable, Text, View } from 'react-native';

import { RadioMark } from '../components/RadioMark';
import { StandSquare } from '../components/StandSquare';
import { distanceMeters, formatDistance } from '../map/geo';
import { makeStyles, sizes, spacing, textStyles } from '../theme';
import { sortStands, type ClubStand } from './placement';

/** The heading over the list. */
export const STANDS_NEAREST_FIRST = 'Stands, nearest first';

/** A stand's second line: "Ladder stand, open", or who is in it. */
export function standDetail(stand: ClubStand): string {
  if (stand.occupiedBy) return `${stand.occupiedBy} is here`;
  return stand.type ? `${STAND_TYPE_LABELS[stand.type]}, open` : 'Open';
}

type Props = {
  stands: readonly ClubStand[];
  /** Where you are, when the phone knows: sorts nearest first and shows how far. */
  here: LatLon | undefined;
  chosen: number | undefined;
  onChoose: (meshId: number) => void;
};

/**
 * The club's stands to check in at: open stands nearest first, taken ones last (you can't
 * pick those). Each row: the stand-type square, name and state, distance, and a radio mark.
 */
export function StandList({ stands, here, chosen, onChoose }: Props) {
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup">
      {sortStands(stands, here).map((stand) => {
        const taken = !!stand.occupiedBy;
        const selected = chosen === stand.meshId;
        const distance = here ? formatDistance(distanceMeters(here, stand.position)) : null;
        const detail = standDetail(stand);
        return (
          <Pressable
            key={stand.meshId}
            accessibilityRole="radio"
            accessibilityLabel={`${stand.name}. ${detail}${distance ? `, ${distance} away` : ''}`}
            accessibilityState={{ selected, disabled: taken }}
            disabled={taken}
            onPress={() => onChoose(stand.meshId)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <StandSquare type={stand.type} />
            <View style={styles.texts}>
              <Text style={[styles.name, taken && styles.taken]}>{stand.name}</Text>
              <Text style={styles.detail}>{detail}</Text>
            </View>
            {distance ? <Text style={styles.distance}>{distance}</Text> : null}
            {taken ? null : <RadioMark chosen={selected} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
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
  name: { ...textStyles.label, color: theme.colors.text },
  taken: { color: theme.colors.textSecondary },
  detail: { ...textStyles.caption, color: theme.colors.textSecondary },
  distance: { ...textStyles.readoutInline, color: theme.colors.text },
}));
