/** Shared fixtures for radio tests (RadioController and RadioProvider). */
import type { PairedRadio } from '../db/pairedRadio';
import type { BackgroundLink, PairedRadioStore } from '../radio/RadioController';
import type { FoundRadio } from '../radio/scan';

export const RADIO_A = { nodeNum: 0x1a2b3c4d, longName: 'Jake radio', shortName: 'JK' };
export const RADIO_B = { nodeNum: 0x0badf00d, longName: 'Sam radio', shortName: 'SM' };

export const FOUND_RADIO: FoundRadio = {
  id: 'AA:BB:CC:DD:EE:FF',
  name: 'Meshtastic 3c4d',
  rssi: -60,
};

/** In-memory paired-radio store; `value` is what SQLite would hold. */
export function memoryStore(
  initial: PairedRadio | null = null,
): PairedRadioStore & { value: PairedRadio | null } {
  return {
    value: initial,
    async load() {
      return this.value;
    },
    async save(radio) {
      this.value = radio;
    },
    async clear() {
      this.value = null;
    },
  };
}

/** Records whether the background link (Android foreground service) is running. */
export function backgroundSpy(): BackgroundLink & { running: boolean } {
  return {
    running: false,
    start() {
      this.running = true;
    },
    stop() {
      this.running = false;
    },
  };
}
