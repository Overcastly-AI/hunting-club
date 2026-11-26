import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DATABASE_NAME, initDatabase } from '../db';
import { colors, fontSources } from '../theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontSources);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          // The app is portrait; only the clubhouse board turns landscape.
          orientation: 'portrait',
        }}
      >
        <Stack.Screen name="board" options={{ orientation: 'landscape' }} />
      </Stack>
    </SQLiteProvider>
  );
}
