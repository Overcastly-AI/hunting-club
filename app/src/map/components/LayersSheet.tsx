import { Download, Map as MapIcon, Trash2 } from 'lucide-react-native';
import { Alert, Text } from 'react-native';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { SegmentedControl } from '../../components/SegmentedControl';
import { makeStyles, textStyles, type StatusTone } from '../../theme';
import { BASEMAP_IDS, BASEMAPS, basemapBySource, type BasemapId } from '../basemaps';
import type { LocalClubMapPack } from '../../club/mapPacks';
import { formatShortDate } from '@huntclub/shared';
import type { MapPack, MapPackStatus } from '../mapPacks';
import { formatBytes } from '../tiles';
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

/** The badge tone beside a downloaded area's status (the word says it too). */
export const PACK_STATUS_TONE: Record<MapPackStatus, StatusTone> = {
  complete: 'success',
  downloading: 'info',
  failed: 'warning',
};

/** Topo and Aerial, for the segmented control. */
const BASEMAP_LABELS = Object.fromEntries(
  BASEMAP_IDS.map((id) => [id, BASEMAPS[id].label]),
) as Record<BasemapId, string>;

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
      <SegmentedControl
        segments={BASEMAP_IDS}
        labels={BASEMAP_LABELS}
        selected={basemap}
        onSelect={onSelect}
      />
      <Text style={styles.credit}>Map data: {BASEMAPS[basemap].attribution}</Text>
      {clubPack && <Text style={styles.credit}>{clubPackText(clubPack)}</Text>}

      <Button
        variant="primary"
        icon={Download}
        label="Download the map for this area"
        onPress={onDownload}
      />

      <Text accessibilityRole="header" style={styles.heading}>
        Downloaded areas
      </Text>
      {packs.length === 0 ? (
        <EmptyState icon={MapIcon} title="No areas saved yet">
          Download the area you hunt so the map works with no signal.
        </EmptyState>
      ) : (
        packs.map((pack) => (
          <Card
            key={pack.id}
            title={`${pack.name} · ${basemapBySource(pack.source)?.label ?? pack.source}`}
            status={
              <Badge
                tone={PACK_STATUS_TONE[pack.status]}
                label={packStatusText(pack, progress[pack.id])}
              />
            }
          >
            <Button
              variant="danger"
              icon={Trash2}
              label="Delete"
              accessibilityHint={`Deletes ${pack.name} from this phone`}
              onPress={() => confirmDelete(pack)}
            />
          </Card>
        ))
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((theme) => ({
  heading: { ...textStyles.title3, color: theme.colors.text },
  credit: { ...textStyles.body, color: theme.colors.textSecondary },
}));
