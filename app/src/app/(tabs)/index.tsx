import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { MapScreen } from '../../map/MapScreen';
import { screenshotMode } from '../../screenshot';
import { MAP_SHOT_PARAM } from '../../screenshot/shots';

export default function MapTab() {
  // The shot param is read only by the dev-only screenshot mode (null in every other build).
  const params = useLocalSearchParams<{ [MAP_SHOT_PARAM]?: string }>();
  const shot = params[MAP_SHOT_PARAM];
  useEffect(() => screenshotMode?.prepareMapShot(shot), [shot]);
  return <MapScreen {...screenshotMode?.mapProps(shot)} />;
}
