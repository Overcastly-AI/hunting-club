import { boundary, colors } from './colors';
import { sizes, radii, spacing } from './sizes';
import { fontFamily, fontSize, textStyles } from './typography';

export { boundary, colors, fontFamily, fontSize, radii, sizes, spacing, textStyles };
export type { ColorToken } from './colors';

export const theme = {
  colors,
  boundary,
  fontFamily,
  fontSize,
  textStyles,
  sizes,
  radii,
  spacing,
} as const;

export type Theme = typeof theme;
