import type { ExpoConfig } from 'expo/config';

// Expo's config loader needs the explicit .ts extension.
import { radioCopy } from './src/radio/copy.ts';
import { colors } from './src/theme/colors.ts';

/** App identifiers (docs/AGENTS.md). */
const APP_ID = 'com.overcastly.huntclub';

/**
 * Android 8.0 (API 26): the lowest version that applies font variation axes
 * (weight and width of the Archivo variable font).
 */
const ANDROID_MIN_SDK = 26;

/**
 * Radio link (Bluetooth to the Meshtastic radio). See docs/research/meshtastic.md §3.
 * iOS: keep the link in the background. Android: Bluetooth permissions with
 * BLUETOOTH_SCAN `neverForLocation`; legacy permissions and location only up
 * to API 30 (./plugins/withRadioPermissions). The Android foreground service
 * is declared by app/modules/radio-service itself.
 */
const RADIO_IOS_BACKGROUND_MODES = ['bluetooth-central'];
const RADIO_PLUGINS: NonNullable<ExpoConfig['plugins']> = [
  [
    'react-native-ble-manager',
    {
      neverForLocation: true,
      bluetoothAlwaysPermission: radioCopy.permissions.iosBluetoothUsage,
    },
  ],
  './plugins/withRadioPermissions',
];

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
    infoPlist: {
      UIBackgroundModes: RADIO_IOS_BACKGROUND_MODES,
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
    ...RADIO_PLUGINS,
  ],
};

export default config;
