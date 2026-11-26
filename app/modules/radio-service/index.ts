import { requireOptionalNativeModule } from 'expo';

/**
 * Android foreground service (type connectedDevice) that keeps the radio link
 * alive in the background. iOS needs no service: the `bluetooth-central`
 * background mode wakes the app on radio notifications, so this module only
 * exists on Android and every call is a no-op elsewhere.
 */
type RadioServiceNative = {
  start(title: string, body: string, channelName: string): void;
  stop(): void;
};

const native = requireOptionalNativeModule<RadioServiceNative>('RadioService');

export type RadioServiceNotice = {
  /** Notification title, e.g. "Connected to your radio". */
  title: string;
  body: string;
  /** Name of the Android notification channel shown in system settings. */
  channelName: string;
};

/** True where a native service is needed and available (Android dev builds). */
export const hasRadioService = native !== null;

/**
 * Starts the service, or updates its notification if it is already running.
 * Returns false if Android refused (for example, a start from the background on
 * Android 12+); the link still works while the app is open.
 */
export function startRadioService(notice: RadioServiceNotice): boolean {
  if (!native) return false;
  try {
    native.start(notice.title, notice.body, notice.channelName);
    return true;
  } catch {
    return false;
  }
}

export function stopRadioService(): void {
  try {
    native?.stop();
  } catch {
    // Already stopped.
  }
}
