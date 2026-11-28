import { formatShortDate } from '@huntclub/shared';
import {
  Check,
  Download,
  Fullscreen,
  Map as MapIcon,
  Pentagon,
  Trash2,
  Users,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';

import type { LocalClubMapPack } from '../../club/mapPacks';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { STAND_ICON_COMPONENTS } from '../../components/icons';
import { Sheet } from '../../components/Sheet';
import { ToggleRow } from '../../components/ToggleRow';
import {
  ICON_SIZE,
  makeStyles,
  sizes,
  spacing,
  textStyles,
  useTheme,
  type StatusTone,
} from '../../theme';
import {
  BASEMAP_VIEWS,
  BASEMAP_VIEW_LABELS,
  BASEMAPS,
  baseOf,
  basemapBySource,
  type BasemapView,
} from '../basemaps';
import {
  MAP_LAYER_IDS,
  MAP_LAYER_LABELS,
  type MapLayerId,
  type MapLayerVisibility,
} from '../layers';
import type { MapPack, MapPackStatus } from '../mapPacks';
import { formatBytes } from '../tiles';
import { BasemapThumb } from './BasemapThumb';

type Props = {
  visible: boolean;
  basemap: BasemapView;
  /** Which layers are drawn over the basemap. */
  layers: MapLayerVisibility;
  onLayerChange: (layer: MapLayerId, on: boolean) => void;
  /** The layers this map has (Club areas only where the club's areas have outlines). */
  available?: readonly MapLayerId[];
  /** Frames the club's ground (its map pack, or its stands); unset with nothing to frame. */
  onFitProperty?: () => void;
  packs: readonly MapPack[];
  /** The club's map pack for this basemap, when one is downloaded. */
  clubPack?: LocalClubMapPack;
  progress: Record<string, number>;
  onSelect: (view: BasemapView) => void;
  onDownload: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/** Each layer's icon in its row. */
const LAYER_ICONS: Record<MapLayerId, LucideIcon> = {
  stands: STAND_ICON_COMPONENTS.ArrowUpFromLine,
  areas: Pentagon,
  hunters: Users,
  scent: Wind,
};

export function packStatusText(pack: MapPack, percentage: number | undefined): string {
  if (pack.status === 'failed') return 'Download failed';
  if (pack.status === 'downloading') return `Downloading ${Math.floor(percentage ?? 0)}%`;
  return pack.sizeBytes ? `Ready offline, ${formatBytes(pack.sizeBytes)}` : 'Ready offline';
}

/** The badge tone beside a downloaded area's status (the word says it too). */
export const PACK_STATUS_TONE: Record<MapPackStatus, StatusTone> = {
  complete: 'success',
  downloading: 'info',
  failed: 'warning',
};

/** "Club map: downloaded Nov 26, 48 MB". */
export function clubPackText(pack: LocalClubMapPack): string {
  const date = formatShortDate(new Date(pack.downloadedAt));
  return `Club map: downloaded ${date}, ${formatBytes(pack.sizeBytes)}`;
}

/** What is saved on this phone: the heading, then the club's map and each downloaded area. */
export const SAVED_ON_THIS_PHONE = 'Saved on this phone';

/** The Layers button that frames the club's ground. */
export const FIT_PROPERTY = 'Fit property';

/**
 * Map layers (docs/DESIGN.md "Map chrome" 3, "Phone, layers open"): the three basemap
 * thumbnails, Fit property, the on/off rows for what is drawn over them (stands, club areas,
 * hunters, your scent), then the maps saved on this phone so they work offline.
 */
export function LayersSheet({
  visible,
  basemap,
  layers,
  onLayerChange,
  available = MAP_LAYER_IDS,
  onFitProperty,
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
      <View style={styles.thumbs}>
        {BASEMAP_VIEWS.map((view) => (
          <BasemapThumb
            key={view}
            view={view}
            label={BASEMAP_VIEW_LABELS[view]}
            selected={view === basemap}
            onPress={() => onSelect(view)}
          />
        ))}
      </View>
      <Text style={styles.credit}>Map data: {BASEMAPS[baseOf(basemap)].attribution}</Text>
      {onFitProperty ? (
        <Button icon={Fullscreen} label={FIT_PROPERTY} onPress={onFitProperty} />
      ) : null}

      <View style={styles.rows}>
        {available.map((id) => (
          <ToggleRow
            key={id}
            label={MAP_LAYER_LABELS[id]}
            icon={LAYER_ICONS[id]}
            on={layers[id]}
            onChange={(on) => onLayerChange(id, on)}
          />
        ))}
      </View>

      <Text accessibilityRole="header" style={styles.heading}>
        {SAVED_ON_THIS_PHONE}
      </Text>
      {packs.length === 0 && !clubPack ? (
        <EmptyState icon={MapIcon} title="No areas saved yet">
          Download the area you hunt so the map works with no signal.
        </EmptyState>
      ) : (
        <View style={styles.rows}>
          {clubPack ? (
            <SavedRow icon={Check} title="Club map" detail={clubPackText(clubPack)} />
          ) : null}
          {packs.map((pack) => (
            <SavedRow
              key={pack.id}
              icon={Download}
              title={`${pack.name}, ${basemapBySource(pack.source)?.label ?? pack.source}`}
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
            </SavedRow>
          ))}
        </View>
      )}
      <Button
        variant="primary"
        icon={Download}
        label="Download the map for this area"
        onPress={onDownload}
      />
    </Sheet>
  );
}

/** One thing saved on the phone: a row under a hairline, not a card. */
function SavedRow({
  icon: Icon,
  title,
  detail,
  status,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.saved}>
      <View style={styles.savedHead}>
        <Icon
          size={ICON_SIZE.md}
          color={theme.colors.textSecondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.savedTexts}>
          <Text style={styles.savedTitle}>{title}</Text>
          {detail ? <Text style={styles.savedDetail}>{detail}</Text> : null}
          {status ?? null}
        </View>
      </View>
      {children ?? null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  thumbs: { flexDirection: 'row', gap: spacing.sm },
  rows: { borderBottomWidth: 1, borderColor: theme.colors.borderSubtle },
  heading: { ...textStyles.title3, color: theme.colors.text },
  credit: { ...textStyles.caption, color: theme.colors.textSecondary },
  saved: {
    minHeight: sizes.listRow,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs / 2,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  savedHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + spacing.xs },
  savedTexts: { flex: 1, gap: spacing.xs },
  savedTitle: { ...textStyles.label, color: theme.colors.text },
  savedDetail: { ...textStyles.caption, color: theme.colors.textSecondary },
}));
