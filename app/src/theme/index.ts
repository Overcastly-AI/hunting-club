import {
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
import { archivo, mapTextHalo, maxFontScale, textStyles } from './typography';

export {
  archivo,
  boundary,
  colors,
  fontAxisLimits,
  fontFamily,
  fontSize,
  fontSources,
  fontWeight,
  fontWidth,
  mapTextHalo,
  maxFontScale,
  opacity,
  radii,
  sizes,
  spacing,
  textStyles,
};
export type { ColorToken, FontWeight, FontWidth } from '@huntclub/design';

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

export type Theme = typeof theme;
