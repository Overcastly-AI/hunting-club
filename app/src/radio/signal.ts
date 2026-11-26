import { radioCopy } from './copy';

/** RSSI thresholds (dBm) for the word labels in the scan list. */
const STRONG_DBM = -70;
const GOOD_DBM = -85;

export type SignalLevel = keyof typeof radioCopy.signal;

export function signalLevel(rssi: number): SignalLevel {
  if (rssi >= STRONG_DBM) return 'strong';
  if (rssi >= GOOD_DBM) return 'good';
  return 'weak';
}

export function signalLabel(rssi: number): string {
  return radioCopy.signal[signalLevel(rssi)];
}
