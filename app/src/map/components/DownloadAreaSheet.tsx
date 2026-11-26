import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { formatShortDate } from '../../conditions/clock';
import { makeStyles, spacing, textStyles } from '../../theme';
import { BASEMAP_IDS, BASEMAPS, type BasemapId } from '../basemaps';
import type { DownloadRequest } from '../offline';
import {
  DETAIL_LEVELS,
  DOWNLOAD_LIMITS,
  estimateDownload,
  formatBytes,
  type Bounds,
  type DetailLevel,
} from '../tiles';
import { Choice } from '../../components/Choice';
import { Sheet } from '../../components/Sheet';
import { Field } from '../../components/Field';

type LayerChoice = BasemapId | 'both';

const LAYER_CHOICES: { id: LayerChoice; label: string; basemaps: BasemapId[] }[] = [
  ...BASEMAP_IDS.map((id) => ({ id, label: BASEMAPS[id].label, basemaps: [id] })),
  { id: 'both', label: 'Both', basemaps: [...BASEMAP_IDS] },
];

type Props = {
  visible: boolean;
  /** The area on screen when the user tapped download. */
  bounds: Bounds | null;
  onStart: (request: DownloadRequest) => Promise<void>;
  onClose: () => void;
  /** What is being saved (default: the area on screen). */
  intro?: string;
};

const DEFAULT_INTRO =
  'Saves the map you can see now so it works with no signal. Maps come free from USGS. Use Wi-Fi if you can.';

/** Total estimate for one detail level across the chosen layers. */
export function estimateForLayers(
  bounds: Bounds,
  level: DetailLevel,
  basemaps: readonly BasemapId[],
) {
  const estimates = basemaps.map((basemap) => estimateDownload(bounds, level, basemap));
  return {
    bytes: estimates.reduce((sum, e) => sum + e.bytes, 0),
    tooBig: estimates.some((e) => e.overLimit !== null),
  };
}

const defaultName = () => `Area saved ${formatShortDate(new Date())}`;

/** "Download the map for this area": choose layers and detail, see the size, start. */
export function DownloadAreaSheet({
  visible,
  bounds,
  onStart,
  onClose,
  intro = DEFAULT_INTRO,
}: Props) {
  const styles = useStyles();
  const [layer, setLayer] = useState<LayerChoice>('both');
  const [levelId, setLevelId] = useState(DETAIL_LEVELS[DETAIL_LEVELS.length - 1]!.id);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const basemaps = LAYER_CHOICES.find((c) => c.id === layer)!.basemaps;
  const estimates = useMemo(
    () =>
      bounds
        ? DETAIL_LEVELS.map((level) => ({ level, ...estimateForLayers(bounds, level, basemaps) }))
        : [],
    [bounds, basemaps],
  );
  const chosen = estimates.find((e) => e.level.id === levelId);
  const canStart = !!bounds && !!chosen && !chosen.tooBig && !busy;

  const start = async () => {
    if (!bounds || !chosen) return;
    setBusy(true);
    try {
      await onStart({ name: name.trim() || defaultName(), bounds, level: chosen.level, basemaps });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Download this area" onClose={onClose}>
      <Text style={styles.body}>{intro}</Text>

      <Text accessibilityRole="header" style={styles.heading}>
        Layers
      </Text>
      <View accessibilityRole="radiogroup" style={styles.group}>
        {LAYER_CHOICES.map((choice) => (
          <Choice
            key={choice.id}
            label={choice.label}
            selected={layer === choice.id}
            onPress={() => setLayer(choice.id)}
          />
        ))}
      </View>

      <Text accessibilityRole="header" style={styles.heading}>
        Detail
      </Text>
      <View accessibilityRole="radiogroup" style={styles.group}>
        {estimates.map(({ level, bytes, tooBig }) => (
          <Choice
            key={level.id}
            label={level.label}
            detail={tooBig ? 'Too big. Zoom in to a smaller area' : `About ${formatBytes(bytes)}`}
            selected={levelId === level.id}
            disabled={tooBig}
            onPress={() => setLevelId(level.id)}
          />
        ))}
      </View>
      <Text style={styles.body}>
        Limit: {DOWNLOAD_LIMITS.maxTiles.toLocaleString()} map tiles or{' '}
        {formatBytes(DOWNLOAD_LIMITS.maxBytes)} per layer.
      </Text>

      <Field label="Name this area (optional)" value={name} onChangeText={setName} maxLength={40} />

      <Button
        variant="primary"
        label={busy ? 'Starting download…' : 'Download'}
        detail={chosen && !chosen.tooBig ? `About ${formatBytes(chosen.bytes)}` : undefined}
        disabled={!canStart}
        onPress={() => void start()}
      />
    </Sheet>
  );
}

const useStyles = makeStyles((theme) => ({
  group: { gap: spacing.sm },
  heading: { ...textStyles.label, color: theme.colors.text },
  body: { ...textStyles.body, color: theme.colors.textSecondary },
}));
