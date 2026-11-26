import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { darkTheme, lightTheme, themes } from '@huntclub/design';
import { loadThemePreference, saveThemePreference } from '../../db/appState';
import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import {
  makeStyles,
  resolveThemeName,
  ThemeProvider,
  useTheme,
  useThemePreference,
  type ThemePreference,
} from '..';

/** What the phone reports as its appearance (iOS Appearance, Android dark theme). */
let mockSystemScheme: 'light' | 'dark' | null = 'dark';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockSystemScheme,
}));
beforeEach(() => {
  mockSystemScheme = 'dark';
});

async function migratedDb() {
  const db = createTestDatabase();
  await migrate(db, migrations);
  return db;
}

/** The latest setPreference the probe saw (the test presses it like the Settings control). */
const choices: ((p: ThemePreference) => Promise<void>)[] = [];
const setPreference = (p: ThemePreference) => choices[choices.length - 1]!(p);
function Probe() {
  const theme = useTheme();
  const choice = useThemePreference();
  choices.push(choice.setPreference);
  return <Text>{`${choice.preference}:${theme.colorScheme}:${theme.colors.surface0}`}</Text>;
}

describe('resolveThemeName', () => {
  it('follows the phone for System, dark when the phone does not say', () => {
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', null)).toBe('dark');
    expect(resolveThemeName('system', 'unspecified')).toBe('dark');
  });

  it('keeps a forced theme whatever the phone says', () => {
    expect(resolveThemeName('dark', 'light')).toBe('dark');
    expect(resolveThemeName('light', 'dark')).toBe('light');
  });
});

describe('ThemeProvider', () => {
  it('starts on System and follows the phone appearance', async () => {
    const db = await migratedDb();
    mockSystemScheme = 'light';
    await render(
      <ThemeProvider db={db}>
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByText(`system:light:${lightTheme.colors.surface0}`)).toBeTruthy();
  });

  it('uses the colours from @huntclub/design, not copies', async () => {
    const db = await migratedDb();
    const seen: unknown[] = [];
    function Grab() {
      seen.push(useTheme());
      return null;
    }
    await render(
      <ThemeProvider db={db}>
        <Grab />
      </ThemeProvider>,
    );
    expect(seen[seen.length - 1]).toBe(themes.dark);
  });

  it('saves a choice on the phone and loads it on the next launch', async () => {
    const db = await migratedDb();
    const first = await render(
      <ThemeProvider db={db}>
        <Probe />
      </ThemeProvider>,
    );
    await screen.findByText(`system:dark:${darkTheme.colors.surface0}`);

    await act(() => setPreference('light'));
    expect(screen.getByText(`light:light:${lightTheme.colors.surface0}`)).toBeTruthy();
    expect(await loadThemePreference(db)).toBe('light');

    await first.unmount();
    mockSystemScheme = 'dark';
    await render(
      <ThemeProvider db={db}>
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByText(`light:light:${lightTheme.colors.surface0}`)).toBeTruthy();
  });

  it('a forced Dark ignores a light phone', async () => {
    const db = await migratedDb();
    await saveThemePreference(db, 'dark');
    mockSystemScheme = 'light';
    await render(
      <ThemeProvider db={db}>
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByText(`dark:dark:${darkTheme.colors.surface0}`)).toBeTruthy();
  });
});

describe('useTheme outside a provider', () => {
  it('is the dark theme', async () => {
    function Name() {
      return <Text>{useTheme().colorScheme}</Text>;
    }
    await render(<Name />);
    expect(screen.getByText('dark')).toBeTruthy();
  });
});

describe('makeStyles', () => {
  const useStyles = makeStyles((theme) => ({ box: { backgroundColor: theme.colors.surface1 } }));

  it('builds each theme once and switches with the theme', async () => {
    const db = await migratedDb();
    const seen: object[] = [];
    function Box() {
      const styles = useStyles();
      seen.push(styles);
      return <Text>{String(styles.box.backgroundColor)}</Text>;
    }
    const view = await render(
      <ThemeProvider db={db}>
        <Box />
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByText(darkTheme.colors.surface1)).toBeTruthy();
    await view.rerender(
      <ThemeProvider db={db}>
        <Box />
        <Probe />
      </ThemeProvider>,
    );
    // Same theme: the same StyleSheet object, not a rebuilt one.
    expect(seen[seen.length - 1]).toBe(seen[0]);

    await act(() => setPreference('light'));
    expect(screen.getByText(lightTheme.colors.surface1)).toBeTruthy();
  });
});
