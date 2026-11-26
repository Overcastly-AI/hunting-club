import { boundary, colors } from './colors';
import { opacity, sizes, radii, spacing } from './sizes';
import { fontFamily, fontSize, mapTextHalo, textStyles } from './typography';

export {
  boundary,
  colors,
  fontFamily,
  fontSize,
  mapTextHalo,
  opacity,
  radii,
  sizes,
  spacing,
  textStyles,
};
export type { ColorToken } from './colors';

export const theme = {
  colors,
  boundary,
  fontFamily,
  fontSize,
  textStyles,
  mapTextHalo,
  sizes,
  opacity,
  radii,
  spacing,
} as const;

export type Theme = typeof theme;
