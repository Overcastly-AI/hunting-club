import {
  SHEET_DETENTS,
  SHEET_TOGGLE,
  mapChrome,
  sheetDetentHeights,
  snapDetent,
  type SheetDetent,
} from '@huntclub/design';
import { ChevronDown } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { Grabber } from '../../components/Grabber';
import { ICON_SIZE, makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../../theme';

/** What each detent is called to a screen reader. */
export const DETENT_NAMES: Record<SheetDetent, string> = {
  peek: 'Peek',
  half: 'Half open',
  full: 'Open',
};

/** A press that moves less than this is not a drag. */
const DRAG_SLOP = 4;

type Props = {
  /** Where the map starts under the status bar, and how tall it is down to the tab bar. */
  mapTop: number;
  mapHeight: number;
  /** At full, the header: this name in place of the status line, beside a collapse button. */
  title: string;
  detent: SheetDetent;
  onDetent: (detent: SheetDetent) => void;
  reduceMotion: boolean;
  /** The status line, inside the 48 px grabber zone; its words are spoken for the zone. */
  status: ReactNode;
  statusSpoken: string;
  /** The action row under the grabber zone: always on screen. */
  actions: ReactNode;
  /** What half and full show under the peek. */
  children: ReactNode;
  testID?: string;
};

/**
 * One bottom sheet with real detents (docs/DESIGN.md "Map chrome" 4): peek (the app's 104 px:
 * the grabber zone and the action row), half and full of the map. The 48 px grabber zone drags
 * it; a release snaps to the nearest detent, and a flick moves one detent its way (snapDetent).
 * Screen readers move it with swipe up and down on the zone. The peek never hides. At full it
 * covers the map with its own header: the title (the club's name) and a 48 px collapse button
 * that returns it to half (the map screen hides its pill, stack and footer meanwhile). Built on
 * React Native's own PanResponder and Animated: no gesture library.
 */
export function DetentSheet(props: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const full = props.detent === 'full';
  const [measuredPeek, setMeasuredPeek] = useState(0);
  const heights = useMemo(() => {
    const spec = sheetDetentHeights(props.mapHeight, 'app');
    // Large text makes the peek taller; it is never cut.
    const peek = Math.max(spec.peek, measuredPeek);
    return { peek, half: Math.max(peek, spec.half), full: Math.max(peek, spec.full) };
  }, [props.mapHeight, measuredPeek]);
  const offsetOf = (detent: SheetDetent) => heights.full - heights[detent];
  const [translate] = useState(() => new Animated.Value(offsetOf(props.detent)));

  const settle = (detent: SheetDetent, animate = true) => {
    const toValue = heights.full - heights[detent];
    if (props.reduceMotion || !animate) translate.setValue(toValue);
    else
      Animated.spring(translate, {
        toValue,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start();
  };
  // A new detent slides there; a new map size (or the first layout) just moves it.
  const shownDetent = useRef(props.detent);
  useEffect(() => {
    settle(props.detent, shownDetent.current !== props.detent);
    shownDetent.current = props.detent;
  }, [props.detent, heights, props.reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const { detent, onDetent } = props;
  // Made again when the detent or the map's size changes (never during a drag).
  const pan = useMemo(() => {
    // A drag starts from the detent the sheet is at: its offset down from full.
    const from = heights.full - heights[detent];
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > DRAG_SLOP,
      onPanResponderGrant: () => translate.stopAnimation(),
      onPanResponderMove: (_e, g) => {
        translate.setValue(Math.min(heights.full - heights.peek, Math.max(0, from + g.dy)));
      },
      onPanResponderRelease: (_e, g) => {
        const height = heights.full - (from + g.dy);
        // PanResponder's vy is px per ms, positive downward, as snapDetent takes it.
        const next = snapDetent(heights, detent, height, g.vy);
        if (next === detent) settle(detent);
        onDetent(next);
      },
      onPanResponderTerminate: () => settle(detent),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translate, heights, detent, onDetent, props.reduceMotion]);

  const step = (event: AccessibilityActionEvent) => {
    const at = SHEET_DETENTS.indexOf(props.detent);
    const by = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    const next = SHEET_DETENTS[Math.max(0, Math.min(SHEET_DETENTS.length - 1, at + by))]!;
    props.onDetent(next);
  };

  return (
    <Animated.View
      testID={props.testID}
      style={[
        styles.sheet,
        { top: props.mapTop + props.mapHeight - heights.full },
        { transform: [{ translateY: translate }] },
      ]}
    >
      <View onLayout={(e: LayoutChangeEvent) => setMeasuredPeek(e.nativeEvent.layout.height)}>
        <View style={styles.zone}>
          <View
            {...pan.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={full ? props.title : props.statusSpoken}
            accessibilityValue={{ text: DETENT_NAMES[props.detent] }}
            accessibilityHint="Swipe up or down to show more or less"
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={step}
            style={styles.handle}
            testID="map-sheet-handle"
          >
            <Grabber />
            {full ? (
              <Text testID="map-sheet-title" numberOfLines={1} style={styles.title}>
                {props.title}
              </Text>
            ) : (
              props.status
            )}
          </View>
          {full ? (
            // Outside the zone's one accessible element, so a screen reader reaches it on its own.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SHEET_TOGGLE.less}
              onPress={() => props.onDetent('half')}
              style={({ pressed }) => [styles.collapse, pressed && styles.pressed]}
              testID="map-sheet-collapse"
            >
              <ChevronDown
                size={ICON_SIZE.md}
                color={theme.colors.text}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.actions}>{props.actions}</View>
      </View>
      <ScrollView
        scrollEnabled={props.detent === 'full'}
        contentContainerStyle={styles.more}
        // Hidden from screen readers at peek, where it is off screen.
        importantForAccessibility={props.detent === 'peek' ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={props.detent === 'peek'}
      >
        {props.children}
      </ScrollView>
    </Animated.View>
  );
}

const useStyles = makeStyles((theme) => ({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.plate,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  // The 48 px zone: the part that drags (the grabber over the one status line, or at full the
  // title) and, at full, the collapse button beside it.
  zone: { flexDirection: 'row', alignItems: 'flex-end' },
  handle: {
    flex: 1,
    minHeight: mapChrome.sheet.handleZone,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  title: { ...textStyles.label, color: theme.colors.text },
  collapse: {
    width: sizes.minTapTarget,
    height: sizes.minTapTarget,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
  },
  pressed: { backgroundColor: theme.colors.raised },
  actions: {
    minHeight: mapChrome.sheet.actionRow,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  more: { gap: spacing.sm, padding: spacing.sm + spacing.xs },
}));
