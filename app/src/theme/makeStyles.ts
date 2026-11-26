import type { Theme } from '@huntclub/design';
import { StyleSheet } from 'react-native';

import { useTheme } from './ThemeProvider';

/** What StyleSheet.create accepts: named view, text and image styles. */
type NamedStyles = Parameters<typeof StyleSheet.create>[0];

/**
 * A component's styles built from the current theme:
 * `const useStyles = makeStyles((theme) => ({ … }))` at module level, then
 * `const styles = useStyles()` in the component. Each theme's StyleSheet is built
 * once and shared by every instance (memoised per theme).
 */
export function makeStyles<S extends NamedStyles>(
  build: (theme: Theme) => S & NamedStyles,
): () => Readonly<S> {
  const cache = new WeakMap<Theme, Readonly<S>>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(build(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
