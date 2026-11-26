import { Tabs } from 'expo-router/js-tabs';

import { colors, sizes, textStyles } from '../../theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: { minHeight: sizes.minTapTarget },
        tabBarLabelStyle: textStyles.tabLabel,
        tabBarLabelPosition: 'below-icon',
        // Icons come with the screens that need them; every tab keeps a word label.
        tabBarIcon: () => null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Map', tabBarAccessibilityLabel: 'Map' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarAccessibilityLabel: 'Chat' }} />
      <Tabs.Screen
        name="check-in"
        options={{ title: 'Check In', tabBarAccessibilityLabel: 'Check In' }}
      />
      <Tabs.Screen
        name="party"
        options={{ title: 'Party/Club', tabBarAccessibilityLabel: 'Party or Club' }}
      />
    </Tabs>
  );
}
