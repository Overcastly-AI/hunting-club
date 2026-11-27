import { basemapSwatch, type Theme, type ThemePreference } from '@huntclub/design';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import type { TestInstance } from 'test-renderer';

import { saveThemePreference } from '../db/appState';
import { migrate } from '../db/migrate';
import { migrations } from '../db/migrations';
import { ThemeProvider } from '../theme';
import { createTestDatabase } from './nodeSqlite';

/**
 * Wraps a screen in the real ThemeProvider with the hunter's theme choice saved on a
 * test database, so it draws exactly as it would after choosing that theme in Settings.
 * ThemeProvider renders nothing until the choice is loaded: wait for the screen's content.
 */
export async function inTheme(ui: ReactElement, preference: ThemePreference) {
  const db = createTestDatabase();
  await migrate(db, migrations);
  await saveThemePreference(db, preference);
  return <ThemeProvider db={db}>{ui}</ThemeProvider>;
}

/** Style keys and props that carry a colour (text, fills, edges, icons, placeholders). */
const COLOR_PROPS = ['color', 'fill', 'stroke', 'placeholderTextColor', 'tintColor'];
const NOT_A_COLOR = new Set(['transparent', 'none', 'currentColor']);

function colorsOf(node: TestInstance): [string, string][] {
  const style = (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
  const fromStyle = Object.entries(style).filter(([key]) => key === 'color' || /Color$/.test(key));
  const fromProps = COLOR_PROPS.map((key) => [key, node.props[key]] as const);
  return [...fromStyle, ...fromProps].filter(
    (pair): pair is [string, string] => typeof pair[1] === 'string' && !NOT_A_COLOR.has(pair[1]),
  );
}

/**
 * Imagery, not interface: the basemap thumbnails in the layers sheet are little pictures of
 * the map, which is the same picture in both themes (docs/DESIGN.md "Palette").
 */
const IMAGERY = Object.values(basemapSwatch);

/**
 * Every colour on the rendered screen that is not one of `theme`'s tokens (or imagery), for
 * example a static dark colour left behind in the light theme. Empty when the screen follows
 * the theme.
 */
export function offThemeColors(container: TestInstance, theme: Theme): string[] {
  const allowed = new Set(
    [...Object.values(theme.colors), ...IMAGERY].map((value) => value.toUpperCase()),
  );
  return container
    .queryAll(() => true)
    .flatMap((node) =>
      colorsOf(node)
        .filter(([, value]) => !allowed.has(value.toUpperCase()))
        .map(([key, value]) => `${node.type} ${key} ${value}`),
    );
}
