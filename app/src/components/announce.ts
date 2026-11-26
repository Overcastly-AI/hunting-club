import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Announces `message` to screen readers when it appears or changes, on both platforms.
 * Android reads it from the view's `accessibilityLiveRegion="polite"`; iOS has no live
 * regions, so it is announced here. Pass undefined for nothing to say.
 *
 * `withoutLiveRegion`: the message is not drawn in a live region (for example it sums up
 * text that changes every second, which a live region would read every second), so it
 * is announced here on Android too.
 */
export function useAnnounce(
  message: string | undefined,
  { withoutLiveRegion = false }: { withoutLiveRegion?: boolean } = {},
): void {
  useEffect(() => {
    if (message && (withoutLiveRegion || Platform.OS === 'ios')) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message, withoutLiveRegion]);
}
