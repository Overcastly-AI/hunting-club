import { mapChrome } from '@huntclub/design';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { useReduceMotion } from '../../hooks/useReduceMotion';

/** What the map's region events say about the move (MapLibre's ViewStateChangeEvent). */
type MoveEvent = { nativeEvent: { userInteraction?: boolean } };

/**
 * Auto-hide (docs/DESIGN.md "Map chrome" 5): a pan, zoom or rotate by the hunter fades the
 * pill, the icon stack and the footer over `fadeMs`; they come back once the map has been still
 * for `idleMs`, or at once on `show()` (a map tap). While `pinned` (an alert, a quiet mesh, near
 * an overdue time; `chromePinned`) nothing hides. Under reduced motion the fade is instant.
 * The sheet's peek is not part of this: it never hides.
 */
export function useAutoHide(pinned: boolean) {
  const reduceMotion = useReduceMotion();
  const [moving, setMoving] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidden = moving && !pinned;

  const clearIdle = () => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
  };

  const shown = useRef(!hidden);
  useEffect(() => {
    const toValue = hidden ? 0 : 1;
    const changed = shown.current === hidden;
    shown.current = !hidden;
    if (reduceMotion || !changed) {
      opacity.setValue(toValue);
      return;
    }
    const fade = Animated.timing(opacity, {
      toValue,
      duration: mapChrome.autoHide.fadeMs,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [hidden, reduceMotion, opacity]);

  useEffect(() => clearIdle, []);

  /** The map started to move: hide, if the hunter moved it (not Find me or Fit property). */
  const onMoveStart = useCallback((event: MoveEvent) => {
    if (!event.nativeEvent.userInteraction) return;
    clearIdle();
    setMoving(true);
  }, []);

  /** The map stopped: the chrome comes back after `idleMs` still, unless it moves again. */
  const onMoveEnd = useCallback(() => {
    clearIdle();
    idle.current = setTimeout(() => setMoving(false), mapChrome.autoHide.idleMs);
  }, []);

  /** A tap on the map: everything back at once. */
  const show = useCallback(() => {
    clearIdle();
    setMoving(false);
  }, []);

  return { hidden, opacity, onMoveStart, onMoveEnd, show };
}
