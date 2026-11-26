import type { ExpoConfig } from 'expo/config';

// Expo's config loader needs the explicit .ts extension.
import { colors } from './src/theme/colors.ts';

/** App identifiers (docs/AGENTS.md). */
const APP_ID = 'com.overcastly.huntclub';

/**
 * Android 8.0 (API 26): the lowest version that applies font variation axes
 * (weight and width of the Archivo variable font).
 */
const ANDROID_MIN_SDK = 26;

const config: ExpoConfig = {
  name: 'Hunt Club Mesh',
  slug: 'hunt-club-mesh',
  scheme: 'huntclub',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: colors.surface,
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_ID,
  },
  android: {
    package: APP_ID,
    adaptiveIcon: {
      backgroundColor: colors.surface,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-font',
    ['expo-build-properties', { android: { minSdkVersion: ANDROID_MIN_SDK } }],
    [
      'expo-splash-screen',
      {
        backgroundColor: colors.surface,
        image: './assets/splash-icon.png',
        imageWidth: 200,
      },
    ],
  ],
};

export default config;
