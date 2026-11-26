import { LocationManager, type GeolocationPosition } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LatLon } from '../domain/location';
import { ensureLocationPermission, toLatLon } from '../permissions/location';

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
    const current = await ensureLocationPermission();
    if (current) {
      setPosition(current);
      if (!listening.current) {
        LocationManager.addListener(listener);
        listening.current = true;
      }
    }
    return current;
  }, [listener]);

  return { position, locate };
}
