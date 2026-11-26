import {
  DEFAULT_THEME_PREFERENCE,
  themes,
  type Theme,
  type ThemeName,
  type ThemePreference,
} from '@huntclub/design';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { loadThemePreference, saveThemePreference } from '../db/appState';
import type { SqlDatabase } from '../db/types';

/**
 * The theme a preference shows. "System" follows the phone's appearance (iOS
 * Appearance, Android dark theme); with no answer from the phone it is dark (dark-first).
 */
export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme === 'light' ? 'light' : 'dark';
}

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Outside a ThemeProvider (component tests) screens draw in the dark theme, the
 * app's default look.
 */
const FALLBACK_THEME: Theme = themes.dark;

/** The current dark or light theme (colours from @huntclub/design `themes`). */
export function useTheme(): Theme {
  return useContext(ThemeContext)?.theme ?? FALLBACK_THEME;
}

/** The hunter's theme choice and a way to change it (Settings → Theme). */
export function useThemePreference(): Pick<ThemeContextValue, 'preference' | 'setPreference'> {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemePreference must be used inside <ThemeProvider>');
  return value;
}

/**
 * Loads the saved theme choice from the phone's database, follows the phone's
 * appearance when it is "System", and gives every screen the resulting theme.
 * Renders nothing until the choice is loaded, so the app never flashes the wrong theme.
 */
export function ThemeProvider({ db, children }: { db: SqlDatabase; children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>();
  useEffect(() => {
    let current = true;
    const settle = (saved: ThemePreference) => {
      // A choice made while loading wins over the saved one.
      if (current) setPreferenceState((chosen) => chosen ?? saved);
    };
    loadThemePreference(db).then(settle, () => settle(DEFAULT_THEME_PREFERENCE));
    return () => {
      current = false;
    };
  }, [db]);
  const setPreference = useCallback(
    async (next: ThemePreference) => {
      setPreferenceState(next);
      await saveThemePreference(db, next);
    },
    [db],
  );
  const value = useMemo(
    () =>
      preference === undefined
        ? null
        : {
            theme: themes[resolveThemeName(preference, systemScheme)],
            preference,
            setPreference,
          },
    [preference, systemScheme, setPreference],
  );
  if (!value) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
