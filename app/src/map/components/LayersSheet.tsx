import { Alert, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { makeStyles, spacing, textStyles } from '../../theme';
import { BASEMAP_IDS, BASEMAPS, basemapBySource, type BasemapId } from '../basemaps';
import type { LocalClubMapPack } from '../../club/mapPacks';
import { formatShortDate } from '../../conditions/clock';
import type { MapPack } from '../mapPacks';
import { formatBytes } from '../tiles';
import { Choice } from '../../components/Choice';
import { Sheet } from '../../components/Sheet';

type Props = {
  visible: boolean;
  basemap: BasemapId;
  packs: readonly MapPack[];
  /** The club's map pack for this basemap, when one is downloaded. */
  clubPack?: LocalClubMapPack;
  progress: Record<string, number>;
  onSelect: (id: BasemapId) => void;
  onDownload: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function packStatusText(pack: MapPack, percentage: number | undefined): string {
  if (pack.status === 'failed') return 'Download failed';
  if (pack.status === 'downloading') return `Downloading ${Math.floor(percentage ?? 0)}%`;
  return pack.sizeBytes ? `Ready offline · ${formatBytes(pack.sizeBytes)}` : 'Ready offline';
}

/** "Club map: downloaded Nov 26, 48 MB". */
export function clubPackText(pack: LocalClubMapPack): string {
  const date = formatShortDate(new Date(pack.downloadedAt));
  return `Club map: downloaded ${date}, ${formatBytes(pack.sizeBytes)}`;
}

/** Topo or aerial, map credits, the club's map, and downloaded areas. */
export function LayersSheet({
  visible,
  basemap,
  packs,
  clubPack,
  progress,
  onSelect,
  onDownload,
  onDelete,
  onClose,
}: Props) {
  const styles = useStyles();
  const confirmDelete = (pack: MapPack) =>
    Alert.alert('Delete this area?', `${pack.name} will no longer work without internet.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(pack.id) },
    ]);

  return (
    <Sheet visible={visible} title="Map layers" onClose={onClose}>
      <View accessibilityRole="radiogroup" style={styles.group}>
        {BASEMAP_IDS.map((id) => (
          <Choice
            key={id}
            label={BASEMAPS[id].label}
            selected={id === basemap}
            onPress={() => onSelect(id)}
          />
        ))}
      </View>
      <Text style={styles.credit}>Map data: {BASEMAPS[basemap].attribution}</Text>
      {clubPack && <Text style={styles.credit}>{clubPackText(clubPack)}</Text>}

      <Button variant="primary" label="Download the map for this area" onPress={onDownload} />

      <Text accessibilityRole="header" style={styles.heading}>
        Downloaded areas
      </Text>
      {packs.length === 0 ? (
        <Text style={styles.credit}>
          None yet. Download the area you hunt so the map works with no signal.
        </Text>
      ) : (
        packs.map((pack) => (
          <View key={pack.id} style={styles.packRow}>
            <View style={styles.packText}>
              <Text style={styles.packName}>
                {pack.name} · {basemapBySource(pack.source)?.label ?? pack.source}
              </Text>
              <Text style={styles.credit}>{packStatusText(pack, progress[pack.id])}</Text>
            </View>
            <Button label="Delete" onPress={() => confirmDelete(pack)} />
          </View>
        ))
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((theme) => ({
  group: { gap: spacing.sm },
  heading: { ...textStyles.label, color: theme.colors.text },
  credit: { ...textStyles.body, color: theme.colors.textSecondary },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  packText: { flex: 1 },
  packName: { ...textStyles.label, color: theme.colors.text },
}));
