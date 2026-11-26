import type { TextStyle } from 'react-native';

import {
  colors,
  fontFamily,
  fontWidth,
  sizes,
  textScale,
  type FontWeight,
  type FontWidth,
  type TextScaleEntry,
} from '@huntclub/design';

// Platform-neutral type tokens (family, weights, widths, sizes, textScale) live in
// @huntclub/design; this file only adds the React Native rendering of them.

/**
 * Archivo at a given weight and width. Both axes are always set explicitly
 * through `fontVariationSettings`, so iOS and Android render the same
 * instance of the variable font. Android needs API 26+, which is why the app's
 * Android minSdkVersion is 26 (app.config.ts).
 *
 * `fontWeight` stays 'normal' on purpose: it overrides weights that libraries
 * (for example React Navigation's tab labels) apply, which would otherwise make
 * iOS look for a separate bold face or Android fake-bold the glyphs.
 */
export function archivo(weight: FontWeight, width: FontWidth = fontWidth.normal) {
  return {
    fontFamily,
    fontWeight: 'normal',
    fontVariationSettings: { wght: weight, wdth: width },
  } as const satisfies TextStyle;
}

function textStyle(entry: TextScaleEntry) {
  return {
    ...archivo(entry.weight, entry.width),
    fontSize: entry.size,
    ...(entry.lineHeight === undefined ? {} : { lineHeight: entry.lineHeight }),
  } satisfies TextStyle;
}

/** Ready-made React Native text styles, one per entry of the shared textScale. */
export const textStyles = Object.fromEntries(
  Object.entries(textScale).map(([name, entry]) => [name, textStyle(entry)]),
) as { readonly [K in keyof typeof textScale]: ReturnType<typeof textStyle> };

/** Dark outline behind all text drawn on the map (map-halo token, 3 px). */
export const mapTextHalo = {
  textShadowColor: colors.mapHalo,
  textShadowRadius: sizes.mapHaloWidth,
  textShadowOffset: { width: 0, height: 0 },
} as const satisfies TextStyle;
