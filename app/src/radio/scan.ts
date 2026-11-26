import { MESHTASTIC_BLE } from '@huntclub/mesh';
import BleManager, { type Peripheral } from 'react-native-ble-manager';

import { ensureBleStarted } from './bleManager';

/** A radio seen in a Bluetooth scan. */
export type FoundRadio = {
  /** Android MAC address or iOS peripheral UUID. */
  id: string;
  name: string;
  rssi: number;
};

export const SCAN_SECONDS = 10;
const UNNAMED_RADIO = 'Meshtastic radio';

export function toFoundRadio(p: Peripheral): FoundRadio {
  return { id: p.id, name: p.advertising?.localName || p.name || UNNAMED_RADIO, rssi: p.rssi };
}

export type ScanCallbacks = {
  onFound(radio: FoundRadio): void;
  onDone(): void;
};

/**
 * Scans for Meshtastic radios (filtered by service UUID, which iOS also needs
 * for background scans). Reports each radio again when its signal changes.
 * Returns a function that stops the scan early.
 */
export async function scanForRadios({ onFound, onDone }: ScanCallbacks): Promise<() => void> {
  await ensureBleStarted();
  const subscriptions = [
    BleManager.onDiscoverPeripheral((p) => onFound(toFoundRadio(p))),
    BleManager.onStopScan(() => finish()),
  ];
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    for (const s of subscriptions) s.remove();
    onDone();
  }
  try {
    await BleManager.scan({
      serviceUUIDs: [MESHTASTIC_BLE.serviceUuid],
      seconds: SCAN_SECONDS,
      allowDuplicates: true,
    });
  } catch (error) {
    finish();
    throw error;
  }
  return () => {
    BleManager.stopScan().catch(() => undefined);
    finish();
  };
}
