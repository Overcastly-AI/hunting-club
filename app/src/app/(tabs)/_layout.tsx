import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatConnector } from '../../chat/ChatConnector';
import { TAB_BAR_PADDING, TAB_LABEL_MAX_LINES, tabBarHeight } from '../../navigation/tabBarLayout';
import { SafetyLayer } from '../../safety/SafetyLayer';
import { colors, maxFontScale, sizes, textStyles } from '../../theme';

export default function TabLayout() {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.surface },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: tabBarHeight({ fontScale, bottomInset: insets.bottom }),
          },
          tabBarItemStyle: styles.item,
          tabBarLabelPosition: 'below-icon',
          // No icons yet; hide the icon slot so the label gets the whole bar.
          // Every tab keeps a word label.
          tabBarIconStyle: styles.hidden,
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
      <SafetyLayer />
      <ChatConnector />
    </>
  );
}

const styles = StyleSheet.create({
  item: { minHeight: sizes.minTapTarget, paddingVertical: TAB_BAR_PADDING },
  hidden: { display: 'none' },
  label: { ...textStyles.tabLabel, textAlign: 'center' },
});
