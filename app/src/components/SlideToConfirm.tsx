import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { colors, opacity, radii, sizes, spacing, textStyles } from '../theme';
import { clampSlide, slideConfirms } from './slide';

type Props = {
  /** For example "Slide to check in". */
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Why it's disabled, read and shown under the control. */
  disabledReason?: string;
};

/**
 * Drag the thumb across to confirm, so a pocket tap can't check you in or
 * out. Screen-reader users confirm with the standard activate gesture
 * (double-tap); dragging isn't possible for them.
 */
export function SlideToConfirm({ label, onConfirm, disabled, disabledReason }: Props) {
  const [travel, setTravel] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  // The pan responder is created once; it reads the latest props and track size from these refs.
  const disabledRef = useRef(disabled);
  const confirmRef = useRef(onConfirm);
  const travelRef = useRef(0);
  useEffect(() => {
    disabledRef.current = disabled;
    confirmRef.current = onConfirm;
  }, [disabled, onConfirm]);

  // eslint-disable-next-line react-hooks/refs -- the handlers read refs during gestures, never during render
  const [pan] = useState(() => {
    const springBack = () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderMove: (_e, g) => x.setValue(clampSlide(g.dx, travelRef.current)),
      onPanResponderRelease: (_e, g) => {
        springBack();
        if (slideConfirms(g.dx, travelRef.current)) confirmRef.current();
      },
      onPanResponderTerminate: springBack,
    });
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const t = e.nativeEvent.layout.width - THUMB - 2 * INSET;
    travelRef.current = t;
    setTravel(t);
  };

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate' && !disabled) onConfirm();
  };

  return (
    <View style={styles.wrap}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={disabled ? disabledReason : 'Double-tap to confirm'}
        accessibilityState={{ disabled: !!disabled }}
        accessibilityActions={[{ name: 'activate', label }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={onLayout}
        style={[styles.track, disabled && { opacity: opacity.pressed }]}
      >
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Animated.View
          {...pan.panHandlers}
          testID="slide-thumb"
          style={[styles.thumb, { transform: [{ translateX: travel > 0 ? x : 0 }] }]}
        >
          <View style={styles.chevron} />
        </Animated.View>
      </View>
      {disabled && disabledReason ? <Text style={styles.reason}>{disabledReason}</Text> : null}
    </View>
  );
}

const INSET = spacing.xs;
const THUMB = sizes.primaryButtonMaxHeight - 2 * INSET;
const CHEVRON = 12;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  track: {
    height: sizes.primaryButtonMaxHeight,
    borderRadius: radii.primaryButton,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  label: {
    ...textStyles.label,
    fontSize: textStyles.bodyLarge.fontSize,
    color: colors.text,
    textAlign: 'center',
    paddingLeft: THUMB + spacing.md,
    paddingRight: spacing.md,
  },
  thumb: {
    position: 'absolute',
    left: INSET,
    width: THUMB,
    height: THUMB,
    borderRadius: radii.primaryButton - INSET / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: CHEVRON,
    height: CHEVRON,
    borderTopWidth: sizes.hairline + 1,
    borderRightWidth: sizes.hairline + 1,
    borderColor: colors.surface,
    transform: [{ rotate: '45deg' }],
  },
  reason: { ...textStyles.body, color: colors.textSecondary },
});
