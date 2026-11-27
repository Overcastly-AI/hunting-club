import {
  basemapSwatch,
  boundary,
  colors,
  fontAxisLimits,
  fontFamily,
  fontSize,
  fontWeight,
  fontWidth,
  opacity,
  radii,
  sizes,
  spacing,
} from '@huntclub/design';

import { fontSources } from './fonts';
import { makeStyles } from './makeStyles';
import { ThemeProvider, resolveThemeName, useTheme, useThemePreference } from './ThemeProvider';
import { archivo, mapTextHalo, maxFontScale, tabularNums, textStyles } from './typography';

export {
  archivo,
  basemapSwatch,
  boundary,
  colors,
  fontAxisLimits,
  fontFamily,
  fontSize,
  fontSources,
  fontWeight,
  fontWidth,
  makeStyles,
  mapTextHalo,
  maxFontScale,
  opacity,
  radii,
  sizes,
  spacing,
  resolveThemeName,
  tabularNums,
  textStyles,
  ThemeProvider,
  useTheme,
  useThemePreference,
};
export type {
  ColorToken,
  FontWeight,
  FontWidth,
  Theme,
  ThemeColorToken,
  ThemePreference,
} from '@huntclub/design';
export {
  BUTTON_HEIGHT,
  BUTTON_PADDING,
  ICON_SIZE,
  STATUS_TONE_COLORS,
  STATUS_TONES,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
} from '@huntclub/design';
export type { ButtonSize, StatusTone } from '@huntclub/design';

/**
 * Static tokens. `colors` and `boundary` here are the map's own colours (markers,
 * labels and their halo, the property line): they stay the same in both themes.
 * Everything else takes its colours from useTheme() or makeStyles().
 */
export const theme = {
  colors,
  boundary,
  fontFamily,
  fontWeight,
  fontWidth,
  fontSize,
  textStyles,
  mapTextHalo,
  sizes,
  opacity,
  radii,
  spacing,
} as const;
