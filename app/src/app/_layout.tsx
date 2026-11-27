import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';

import { ClubProvider } from '../club/ClubProvider';
import { createAppClubServices } from '../club/cloud';
import { DATABASE_NAME, initDatabase } from '../db';
import { ProfileProvider } from '../profile/ProfileProvider';
import { AppRadioProvider } from '../radio/AppRadioProvider';
import { screenshotMode } from '../screenshot';
import { fontSources, ThemeProvider, useTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();

/** Club sign-in and API clients (inert for free users: nothing is called until they join). */
const clubServices = createAppClubServices();

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
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={screenshotMode?.initDatabase ?? initDatabase}
    >
      <AppProviders>
        <AppStack />
      </AppProviders>
    </SQLiteProvider>
  );
}

/** Every screen, on the current theme's background, with status bar text that reads on it. */
function AppStack() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.plate },
          // The app is portrait; only the clubhouse board turns landscape.
          orientation: 'portrait',
        }}
      >
        <Stack.Screen name="board" options={{ orientation: 'landscape' }} />
      </Stack>
    </>
  );
}

/**
 * App-wide state that needs the database: the theme choice, the hunter's profile,
 * their clubs, then the radio.
 */
function AppProviders({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  // The dev-only screenshot mode puts its stand-in radio here instead (src/screenshot).
  const Radio = screenshotMode?.RadioStandIn ?? AppRadioProvider;
  return (
    <ThemeProvider db={db}>
      <ProfileProvider db={db}>
        <ClubProvider services={clubServices}>
          <Radio>{children}</Radio>
        </ClubProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
