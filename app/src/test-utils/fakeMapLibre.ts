import { createElement, type ReactNode } from 'react';
import { View } from 'react-native';

import type { LatLon } from '@huntclub/mesh';

/**
 * Stand-in for MapLibre's native LocationManager, so the real location
 * permission flow (permissions/location) runs in Jest. Use with
 * `jest.mock('@maplibre/maplibre-react-native', () => jest.requireActual('…/test-utils/fakeMapLibre').fakeMapLibreModule)`.
 */
export const fakeLocationManager = {
  requestPermissions: jest.fn(async () => true),
  /** The phone's position; null when location is unavailable. */
  getCurrentPosition: jest.fn(async (): Promise<unknown> => null),
};

/**
 * Stand-ins for the map's components, so screens with a map (the map strips above Chat and
 * Check In) render in Jest. The map and its markers draw their React children as plain
 * views, which is what the screen tests audit (the markers' plates, labels and tap areas);
 * the basemap, sources and layers draw nothing.
 */
const drawChildren = ({ children, testID }: { children?: ReactNode; testID?: string }) =>
  createElement(View, { testID }, children);
const drawNothing = () => null;

/**
 * The map: its children, and its event props (`onRegionWillChange`, `onPress`, ...) on the view,
 * so a test can fire them: `fireEvent(screen.getByTestId('map'), 'regionWillChange', event)`.
 */
const drawMap = ({
  children,
  testID,
  ...props
}: { children?: ReactNode; testID?: string } & Record<string, unknown>) =>
  createElement(
    View,
    {
      testID,
      ...Object.fromEntries(Object.entries(props).filter(([key]) => /^on[A-Z]/.test(key))),
    },
    children,
  );

export const fakeMapLibreModule = {
  LocationManager: fakeLocationManager,
  Map: drawMap,
  Marker: drawChildren,
  Camera: drawNothing,
  GeoJSONSource: drawChildren,
  Layer: drawNothing,
};

/** Puts the phone at `place` (or nowhere with null). */
export function placePhone(place: LatLon | null): void {
  fakeLocationManager.getCurrentPosition.mockResolvedValue(
    place && { coords: { latitude: place.lat, longitude: place.lon } },
  );
}
