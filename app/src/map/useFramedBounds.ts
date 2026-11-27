import type { LatLon } from '@huntclub/mesh';
import { useMemo } from 'react';

import { boundsAround } from './geo';
import type { Bounds } from './tiles';

/**
 * The box around `points` for a camera that frames them (the clubhouse board, the map strips).
 * The same box object until the box itself changes, so the camera re-frames only when someone
 * moves, not on every clock tick. Undefined with no points.
 */
export function useFramedBounds(points: readonly LatLon[]): Bounds | undefined {
  const framed = boundsAround(points);
  const key = framed?.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => framed, [key]);
}
