import type { FontSource } from 'expo-font';

import { fontFamily } from '@huntclub/design';

/** Font files to load with expo-font, keyed by the family name the theme uses. */
export const fontSources: Record<typeof fontFamily, FontSource> = {
  [fontFamily]: require('../../assets/fonts/Archivo-Variable.ttf'),
};
