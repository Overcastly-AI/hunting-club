import { boundary, colors } from './colors';
import { sizes, radii, spacing } from './sizes';
import { fontSources } from './fonts';
import {
  archivo,
  fontAxisLimits,
  fontFamily,
  fontSize,
  fontWeight,
  fontWidth,
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
  sizes,
  radii,
  spacing,
} as const;

export type Theme = typeof theme;
