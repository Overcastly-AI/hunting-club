import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Announces `message` to screen readers when it appears or changes, on both platforms.
 * Android reads it from the view's `accessibilityLiveRegion="polite"`; iOS has no live
 * regions, so it is announced here. Pass undefined for nothing to say.
 */
export function useAnnounce(message: string | undefined): void {
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
