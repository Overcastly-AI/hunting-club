import { boundary, colors } from './colors';
import { opacity, sizes, radii, spacing } from './sizes';
import { fontSources } from './fonts';
import {
  archivo,
  fontAxisLimits,
  fontFamily,
  fontSize,
  fontWeight,
  fontWidth,
  mapTextHalo,
  textStyles,
} from './typography';

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
  opacity,
  radii,
  sizes,
  spacing,
  textStyles,
};
export type { FontWeight, FontWidth } from './typography';
export type { ColorToken } from './colors';

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
