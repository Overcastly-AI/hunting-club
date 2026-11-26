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

export const fakeMapLibreModule = { LocationManager: fakeLocationManager };

/** Puts the phone at `place` (or nowhere with null). */
export function placePhone(place: LatLon | null): void {
  fakeLocationManager.getCurrentPosition.mockResolvedValue(
    place && { coords: { latitude: place.lat, longitude: place.lon } },
  );
}
