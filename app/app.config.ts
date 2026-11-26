import type { ExpoConfig } from 'expo/config';

// Expo's config loader needs the explicit .ts extension.
import { colors } from './src/theme/colors.ts';
// App identifiers, shared with infra (universal-link files): one source of truth.
import { APP_ID, URL_SCHEME } from '@huntclub/shared/app';

/**
 * Android 8.0 (API 26): the lowest version that applies font variation axes
 * (weight and width of the Archivo variable font).
 */
const ANDROID_MIN_SDK = 26;

/**
 * Plain-language reason for location, shown by iOS in the system prompt. The
 * in-app explanation before it is in src/permissions/location.ts.
 */
const LOCATION_USAGE =
  'Hunt Club Mesh uses your location to put you on the map and center the map on you. It stays on this phone. Your party or club only sees where you are while you are checked in.';

const config: ExpoConfig = {
  name: 'Hunt Club Mesh',
  slug: 'hunt-club-mesh',
  scheme: URL_SCHEME,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: colors.surface,
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_ID,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_USAGE,
    },
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
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
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
    '@maplibre/maplibre-react-native',
  ],
};

export default config;
