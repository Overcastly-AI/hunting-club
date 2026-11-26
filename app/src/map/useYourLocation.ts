import { LocationManager, type GeolocationPosition } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';

import type { LatLon } from './types';

/**
 * Plain-language reasons shown before and after the system location prompt.
 * The iOS system prompt text lives in app.json (NSLocationWhenInUseUsageDescription).
 */
export const LOCATION_COPY = {
  askTitle: 'Show where you are?',
  askBody:
    'Hunt Club uses your phone’s location to put you on the map and center the map on you. It stays on this phone. Your party or club only sees where you are while you are checked in.',
  deniedTitle: 'Location is off',
  deniedBody: 'To center the map on you, allow location for Hunt Club in your phone’s Settings.',
} as const;

const toLatLon = (p: GeolocationPosition): LatLon => ({
  lat: p.coords.latitude,
  lon: p.coords.longitude,
});

function confirm(title: string, body: string, ok: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]),
  );
}

/** Your position on this phone, for "center on me". Asks for permission on first use. */
export function useYourLocation() {
  const [position, setPosition] = useState<LatLon | null>(null);
  const listening = useRef(false);

  const listener = useCallback((p: GeolocationPosition) => setPosition(toLatLon(p)), []);

  useEffect(
    () => () => {
      if (listening.current) LocationManager.removeListener(listener);
    },
    [listener],
  );

  /** Returns your position, asking for permission first if needed; null if unavailable. */
  const locate = useCallback(async (): Promise<LatLon | null> => {
    if (!listening.current) {
      if (!(await confirm(LOCATION_COPY.askTitle, LOCATION_COPY.askBody, 'Continue'))) return null;
      const granted = await LocationManager.requestPermissions();
      const current = granted ? await LocationManager.getCurrentPosition() : undefined;
      if (!current) {
        if (await confirm(LOCATION_COPY.deniedTitle, LOCATION_COPY.deniedBody, 'Open Settings')) {
          await Linking.openSettings();
        }
        return null;
      }
      LocationManager.addListener(listener);
      listening.current = true;
      setPosition(toLatLon(current));
      return toLatLon(current);
    }
    const current = await LocationManager.getCurrentPosition();
    return current ? toLatLon(current) : position;
  }, [listener, position]);

  return { position, locate };
}
