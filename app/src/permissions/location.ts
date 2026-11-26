import { LocationManager, type GeolocationPosition } from '@maplibre/maplibre-react-native';
import type { LatLon } from '@huntclub/mesh';

import { askPermission, offerSettings, type PermissionCopy } from './askPermission';

/**
 * The one place the app asks for location. Every feature that needs the
 * phone's GPS (center on me, check-in at a spot) calls `ensureLocationPermission`.
 *
 * Plain-language reason shown before the system prompt. The iOS system prompt
 * text is NSLocationWhenInUseUsageDescription in the app config.
 */
export const LOCATION_PERMISSION_COPY: PermissionCopy = {
  askTitle: 'Show where you are?',
  askBody:
    'Hunt Club uses your phone’s location to put you on the map and center the map on you. It stays on this phone. Your party or club only sees where you are while you are checked in.',
  deniedTitle: 'Location is off',
  deniedBody: 'To use your location, allow location for Hunt Club in your phone’s Settings.',
};

export const toLatLon = (p: GeolocationPosition): LatLon => ({
  lat: p.coords.latitude,
  lon: p.coords.longitude,
});

let grantedThisSession = false;

/**
 * Explains why, asks the system (Android: fine + coarse; iOS: when in use),
 * and confirms by reading a position. On refusal, offers to open Settings.
 * Returns your position, or null if location is unavailable.
 */
export async function ensureLocationPermission(): Promise<LatLon | null> {
  if (
    !grantedThisSession &&
    !(await askPermission({
      copy: LOCATION_PERMISSION_COPY,
      request: () => LocationManager.requestPermissions(),
    }))
  ) {
    return null;
  }
  const position = await LocationManager.getCurrentPosition();
  if (!position) {
    await offerSettings(LOCATION_PERMISSION_COPY);
    return null;
  }
  grantedThisSession = true;
  return toLatLon(position);
}
