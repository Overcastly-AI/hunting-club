import {
  areaLabelBox,
  placeAreaLabels,
  standLabelCandidate,
  standLabelLayout,
  visibleLabels,
  type Rect,
} from '@huntclub/design';
import { polygonRings, ringsLabelPoint } from '@huntclub/shared';

import type { ClubArea } from '../checkin/placement';
import { screenPoint, type CameraView } from './geo';
import type { OpenStandOnMap } from './types';

/** Which side of its marker a shown stand's name goes. */
export type LabelSide = 'left' | 'right';

/** An area's name on the map: where it is, its words, and how far below that point it sits. */
export type AreaLabel = {
  id: string;
  text: string;
  position: { lat: number; lon: number };
  /** px from `position` down to the label's centre: the drop inside the north edge, moved by `giveWay`. */
  dy: number;
};

export type MapLabels = {
  /** The stands that show their name, and on which side; the rest are icons. */
  stands: ReadonlyMap<string, LabelSide>;
  /** The areas whose name shows, clear of every stand. */
  areas: readonly AreaLabel[];
};

type MapSize = { width: number; height: number };

/**
 * Which names show on a map `size` points big at `view` (docs/DESIGN.md "Map chrome" 8), with
 * the same shared rules as the web: stands by `visibleLabels` (none below `labels.minZoom` but
 * the one tapped, none that would overlap another label or stand), on the side `plateSide`
 * picks; then areas by `placeAreaLabels`, each moving off or hiding from any stand or stand name
 * it would cover, so a tap there lands on the stand.
 */
export function mapLabels(
  stands: readonly OpenStandOnMap[],
  areas: readonly ClubArea[],
  view: CameraView,
  size: MapSize,
  selected: string | null,
): MapLabels {
  const at = (p: { lat: number; lon: number }) => screenPoint(p, view, size);
  const candidates = stands.map((stand) => {
    const { x, y } = at(stand.position);
    return { candidate: standLabelCandidate(stand, x, y, size.width), x };
  });
  const shown = visibleLabels(
    candidates.map((c) => c.candidate),
    view.zoom,
    selected,
  );
  const sides = new Map<string, LabelSide>();
  const obstacles: Rect[] = [];
  candidates.forEach(({ candidate, x }, i) => {
    obstacles.push(candidate.marker);
    if (!shown.has(candidate.id)) return;
    sides.set(candidate.id, standLabelLayout(stands[i]!.name, x, size.width).side);
    obstacles.push(candidate.label);
  });

  const boxes = areas.flatMap((area) => {
    const point = area.boundary ? ringsLabelPoint(polygonRings(area.boundary)) : null;
    if (!point) return [];
    const position = { lon: point[0], lat: point[1] };
    const { x, y } = at(position);
    const { text, rect } = areaLabelBox(area.name, x, y);
    return [{ id: String(area.meshId), text, position, y, rect }];
  });
  const placed = placeAreaLabels(boxes, obstacles, view.zoom);
  const areaLabels = boxes.flatMap(({ id, text, position, y }) => {
    const rect = placed.get(id);
    return rect ? [{ id, text, position, dy: rect.y + rect.height / 2 - y }] : [];
  });
  return { stands: sides, areas: areaLabels };
}
