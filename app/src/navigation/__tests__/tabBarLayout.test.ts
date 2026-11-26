import { maxFontScale, sizes, textStyles } from '../../theme';
import {
  LIBRARY_TAB_ITEM_PADDING,
  TAB_BAR_PADDING,
  TAB_ICON_SIZE,
  TAB_LABEL_MAX_LINES,
  tabBarHeight,
  tabLabelScale,
} from '../tabBarLayout';

const PADDING = 2 * (LIBRARY_TAB_ITEM_PADDING + TAB_BAR_PADDING) + TAB_ICON_SIZE;
const LINE = textStyles.tabLabel.lineHeight;
/** iPhone home-indicator inset (34) and a device with none (Android 3-button nav). */
const INSETS = [34, 0];

describe('tabBarHeight', () => {
  it.each(INSETS)(
    'fits the icon, one label line and padding and a %i px bottom inset',
    (bottomInset) => {
      const height = tabBarHeight({ fontScale: 1, bottomInset });
      expect(height - bottomInset).toBeGreaterThanOrEqual(LINE + PADDING);
      expect(height - bottomInset).toBeGreaterThanOrEqual(sizes.minTapTarget);
    },
  );

  it.each(INSETS)(
    'fits the icon, two lines of 200%% text and a %i px bottom inset',
    (bottomInset) => {
      const height = tabBarHeight({ fontScale: 2, bottomInset });
      expect(height - bottomInset).toBeGreaterThanOrEqual(
        TAB_LABEL_MAX_LINES * LINE * maxFontScale + PADDING,
      );
    },
  );

  it('grows with the text size and stops growing at the cap', () => {
    const at = (fontScale: number) => tabBarHeight({ fontScale, bottomInset: 0 });
    expect(at(1.3)).toBeGreaterThan(at(1));
    expect(at(2)).toBeGreaterThan(at(1.3));
    expect(at(3.1)).toBe(at(maxFontScale));
  });

  it('never shrinks below the default for text smaller than 100%', () => {
    expect(tabBarHeight({ fontScale: 0.85, bottomInset: 0 })).toBe(
      tabBarHeight({ fontScale: 1, bottomInset: 0 }),
    );
  });
});

describe('tabLabelScale', () => {
  it('follows the system text size between 100% and the cap', () => {
    expect(tabLabelScale(0.8)).toBe(1);
    expect(tabLabelScale(1.5)).toBe(1.5);
    expect(tabLabelScale(3)).toBe(maxFontScale);
  });
});
