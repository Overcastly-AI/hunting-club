import { maxFontScale, sizes, spacing, textStyles } from '../theme';

/**
 * Padding React Navigation puts inside every bottom-tab button
 * (`tabVerticalUiKit` in its BottomTabItem). It can't be styled away, so the
 * height calculation has to include it.
 */
export const LIBRARY_TAB_ITEM_PADDING = 5;

/** Space between the tab button and the edge of the bar, above and below. */
export const TAB_BAR_PADDING = spacing.xs;

/** Tab icons sit above the labels at Lucide's 24 px size (docs/UI_REDESIGN.md section 4). */
export const TAB_ICON_SIZE = 24;

/** Long labels wrap onto a second line at large text sizes instead of clipping. */
export const TAB_LABEL_MAX_LINES = 2;

/** The text size the tab labels actually render at: the system scale, capped at `maxFontScale`. */
export function tabLabelScale(fontScale: number): number {
  return Math.min(Math.max(fontScale, 1), maxFontScale);
}

/**
 * Height of the bottom tab bar, including the bottom safe-area inset: the icon,
 * the label under it and the padding around them.
 *
 * At the default text size a label fits on one line. Above it, room for two
 * lines is reserved, because the longest labels wrap at a quarter of a phone's
 * width once text is enlarged.
 */
export function tabBarHeight({
  fontScale,
  bottomInset,
}: {
  fontScale: number;
  bottomInset: number;
}): number {
  const scale = tabLabelScale(fontScale);
  const lines = scale > 1 ? TAB_LABEL_MAX_LINES : 1;
  const labelHeight = Math.ceil(lines * textStyles.tabLabel.lineHeight * scale);
  const padding = 2 * (LIBRARY_TAB_ITEM_PADDING + TAB_BAR_PADDING);
  return Math.max(sizes.minTapTarget, TAB_ICON_SIZE + labelHeight + padding) + bottomInset;
}
