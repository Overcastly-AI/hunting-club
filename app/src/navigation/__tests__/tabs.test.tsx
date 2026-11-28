import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { darkTheme } from '@huntclub/design';
import TabLayout from '../../app/(tabs)/_layout';
import { sizes } from '../../theme';
import { TAB_ICON_SIZE, tabBarHeight } from '../tabBarLayout';
import { TABS } from '../tabs';

// The tab layout's own data and radio layers are not what this test is about.
jest.mock('../../onboarding/useOnboarded', () => ({ useOnboarded: () => true }));
jest.mock('../../safety/SafetyLayer', () => ({ SafetyLayer: () => null }));
jest.mock('../../chat/ChatConnector', () => ({ ChatConnector: () => null }));

async function renderTabs() {
  const screens = Object.fromEntries(
    TABS.map(({ name, title }) => [`(tabs)/${name}`, () => <Text>{`${title} screen`}</Text>]),
  );
  await renderRouter({ '(tabs)/_layout': TabLayout, ...screens }, { initialUrl: '/' });
}

/** The icons drawn for a tab (hidden from screen readers: the word label is spoken). */
const icons = (name: string) =>
  screen.getAllByTestId(`tab-icon-${name}`, { includeHiddenElements: true });

/** Colours a tab's icon is drawn in: the library draws it selected and not, and cross-fades. */
const iconColors = (name: string): unknown[] =>
  icons(name).map((icon) => icon.props.stroke ?? icon.props.color);

describe('bottom tab bar', () => {
  it('lists Map, Chat and Club with Lucide icons (Check In opens from the map)', () => {
    expect(TABS.map((t) => [t.name, t.title, t.icon.displayName])).toEqual([
      ['index', 'Map', 'Map'],
      ['chat', 'Chat', 'MessageSquare'],
      ['party', 'Club', 'Users'],
    ]);
  });

  it('shows an icon above every word label, the selected one in the accent colour', async () => {
    await renderTabs();
    for (const { name, title, accessibilityLabel } of TABS) {
      expect(icons(name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(accessibilityLabel)).toBeTruthy();
    }
    expect(iconColors('index')).toEqual(
      expect.arrayContaining([darkTheme.colors.accentText, darkTheme.colors.textSecondary]),
    );

    fireEvent.press(screen.getByLabelText('Chat'));
    expect(await screen.findByText('Chat screen')).toBeTruthy();
    expect(iconColors('chat')).toContain(darkTheme.colors.accentText);
  });

  it('keeps every tab 48 px or taller, with room for icon and label above the safe area', () => {
    expect(TAB_ICON_SIZE).toBe(24);
    for (const bottomInset of [0, 34, 48]) {
      const height = tabBarHeight({ fontScale: 1, bottomInset }) - bottomInset;
      expect(height).toBeGreaterThanOrEqual(sizes.minTapTarget);
      expect(height).toBeGreaterThan(TAB_ICON_SIZE);
    }
  });
});
