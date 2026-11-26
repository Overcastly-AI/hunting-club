import { LocationManager, type GeolocationPosition } from '@maplibre/maplibre-react-native';
import { Alert, Linking } from 'react-native';

import type { LatLon } from '../domain/location';

/**
 * The one place the app asks for location. Every feature that needs the
 * phone's GPS (center on me, check-in at a spot) calls `ensureLocationPermission`.
 *
 * Plain-language reason shown before the system prompt. The iOS system prompt
 * text is NSLocationWhenInUseUsageDescription in the app config.
 */
export const LOCATION_PERMISSION_COPY = {
  askTitle: 'Show where you are?',
  askBody:
    'Hunt Club uses your phone’s location to put you on the map and center the map on you. It stays on this phone. Your party or club only sees where you are while you are checked in.',
  askContinue: 'Continue',
  deniedTitle: 'Location is off',
  deniedBody: 'To use your location, allow location for Hunt Club in your phone’s Settings.',
  deniedOpenSettings: 'Open Settings',
  notNow: 'Not now',
} as const;

export const toLatLon = (p: GeolocationPosition): LatLon => ({
  lat: p.coords.latitude,
  lon: p.coords.longitude,
});

function confirm(title: string, body: string, ok: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: LOCATION_PERMISSION_COPY.notNow, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]),
  );
}

let grantedThisSession = false;

/**
 * Explains why, asks the system (Android: fine + coarse; iOS: when in use),
 * and confirms by reading a position. On refusal, offers to open Settings.
 * Returns your position, or null if location is unavailable.
 */
export async function ensureLocationPermission(): Promise<LatLon | null> {
  if (!grantedThisSession) {
    const c = LOCATION_PERMISSION_COPY;
    if (!(await confirm(c.askTitle, c.askBody, c.askContinue))) return null;
    if (!(await LocationManager.requestPermissions())) return offerSettings();
  }
  const position = await LocationManager.getCurrentPosition();
  if (!position) return offerSettings();
  grantedThisSession = true;
  return toLatLon(position);
}

async function offerSettings(): Promise<null> {
  const c = LOCATION_PERMISSION_COPY;
  if (await confirm(c.deniedTitle, c.deniedBody, c.deniedOpenSettings))
    await Linking.openSettings();
  return null;
}
