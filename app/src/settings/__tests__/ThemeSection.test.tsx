import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { lightTheme } from '@huntclub/design';
import { loadThemePreference } from '../../db/appState';
import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { a11yProblems } from '../../test-utils/a11yAudit';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { ThemeProvider, useTheme } from '../../theme';
import { ThemeSection } from '../ThemeSection';

/** Which theme the screens are drawn in. */
function Current() {
  return <Text>{useTheme() === lightTheme ? 'drawn light' : 'drawn dark'}</Text>;
}

describe('Settings → Theme', () => {
  it('offers System, Dark and Light, shows the choice and saves it', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    const view = await render(
      <ThemeProvider db={db}>
        <ThemeSection />
        <Current />
      </ThemeProvider>,
    );
    expect(await screen.findByText('Theme')).toBeTruthy();
    for (const label of ['System', 'Dark', 'Light']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
    expect(screen.getByRole('tab', { name: 'System' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(a11yProblems(view.container)).toEqual([]);

    await fireEvent.press(screen.getByRole('tab', { name: 'Dark' }));
    expect(screen.getByText('drawn dark')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Light' }));
    expect(screen.getByRole('tab', { name: 'Light' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByText('drawn light')).toBeTruthy();
    expect(await loadThemePreference(db)).toBe('light');
  });
});
