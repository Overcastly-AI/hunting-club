import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatConnector } from '../../chat/ChatConnector';
import { ONBOARDING_ROUTE } from '../../onboarding/routes';
import { useOnboarded } from '../../onboarding/useOnboarded';
import {
  TAB_BAR_PADDING,
  TAB_ICON_SIZE,
  TAB_LABEL_MAX_LINES,
  tabBarHeight,
} from '../../navigation/tabBarLayout';
import { TABS } from '../../navigation/tabs';
import { SafetyLayer } from '../../safety/SafetyLayer';
import { maxFontScale, sizes, textStyles, useTheme } from '../../theme';

export default function TabLayout() {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const onboarded = useOnboarded();

  if (onboarded === undefined) return null;
  // First launch: onboarding once, then straight to the tabs.
  if (!onboarded) return <Redirect href={ONBOARDING_ROUTE} />;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.surface0 },
          // Selected tab: accent icon and label. Others: secondary text colour.
          tabBarActiveTintColor: theme.colors.accentText,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.colors.surface0,
            borderTopColor: theme.colors.borderSubtle,
            // Includes the bottom safe-area inset (home indicator, Android gesture bar).
            height: tabBarHeight({ fontScale, bottomInset: insets.bottom }),
          },
          tabBarItemStyle: styles.item,
          tabBarLabelPosition: 'below-icon',
          tabBarIconStyle: styles.icon,
          tabBarLabel: ({ color, children }) => (
            <Text
              maxFontSizeMultiplier={maxFontScale}
              numberOfLines={TAB_LABEL_MAX_LINES}
              style={[styles.label, { color }]}
            >
              {children}
            </Text>
          ),
        }}
      >
        {TABS.map(({ name, title, accessibilityLabel, icon: Icon }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarAccessibilityLabel: accessibilityLabel,
              // The word label is spoken; the icon is decoration.
              tabBarIcon: ({ color }) => (
                <Icon
                  testID={`tab-icon-${name}`}
                  size={TAB_ICON_SIZE}
                  color={color}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ),
            }}
          />
        ))}
      </Tabs>
      <SafetyLayer />
      <ChatConnector />
    </>
  );
}

const styles = StyleSheet.create({
  item: { minHeight: sizes.minTapTarget, paddingVertical: TAB_BAR_PADDING },
  // A fixed icon box on every phone (the library's default box changes with the screen size).
  icon: { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE },
  label: { ...textStyles.tabLabel, textAlign: 'center' },
});
