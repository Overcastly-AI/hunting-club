import { fontSize, fontWidth, mapChrome, textWidth, visibleLabels } from '@huntclub/design';

import { sizes, spacing } from '../theme';
import { screenPoint, type CameraView } from './geo';
import type { OpenStandOnMap } from './types';

/** A capped stand label's padding beside its name (MarkerPlate's `cap` look). */
export const LABEL_PAD = spacing.sm;
/** The gap between the stand's 48 px box and its label. */
export const LABEL_GAP = spacing.xs / 2;

/** How wide a stand's capped label is: its name on one line, at most `labels.maxWidth`. */
export const standLabelWidth = (name: string) =>
  Math.min(
    mapChrome.labels.maxWidth,
    2 * LABEL_PAD + textWidth(name, fontSize.markerName, fontWidth.marker),
  );

/**
 * Which stands show their name on a map `size` points big at `view` (docs/DESIGN.md "Map
 * chrome" 8, the shared `visibleLabels`): none below `labels.minZoom` but the one tapped; above
 * it, each unless its label would overlap another label or stand. The rest are icons.
 */
export function labelledStands(
  stands: readonly OpenStandOnMap[],
  view: CameraView,
  size: { width: number; height: number },
  selected: string | null,
): Set<string> {
  const box = sizes.minTapTarget;
  const height = mapChrome.labels.maxHeight;
  const candidates = stands.map((stand) => {
    const { x, y } = screenPoint(stand.position, view, size);
    return {
      id: stand.id,
      marker: { x: x - box / 2, y: y - box / 2, width: box, height: box },
      label: {
        x: x + box / 2 + LABEL_GAP,
        y: y - height / 2,
        width: standLabelWidth(stand.name),
        height,
      },
    };
  });
  return visibleLabels(candidates, view.zoom, selected);
}
