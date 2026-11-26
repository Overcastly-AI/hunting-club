import type { ExpoConfig } from 'expo/config';

// Expo's config loader needs the explicit .ts extension.
import { radioCopy } from './src/radio/copy.ts';
// Constants-only subpath of the shared design tokens (Expo's config loader reads it).
import { colors } from '@huntclub/design/colors';
// App identifiers, shared with infra (universal-link files): one source of truth.
import { APP_ID, URL_SCHEME } from '@huntclub/shared/app';

/**
 * EAS project id: the one place it lives. The owner runs `eas init` once (docs/IOS_BUILD.md)
 * and pastes the id it prints here. Until then EAS builds stop and ask for it.
 */
const EAS_PROJECT_ID: string | undefined = undefined;

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

/**
 * Radio link (Bluetooth to the Meshtastic radio). See docs/research/meshtastic.md §3.
 * iOS: keep the link in the background. Android: Bluetooth permissions with
 * BLUETOOTH_SCAN `neverForLocation`; legacy permissions only up to API 30
 * (./plugins/withRadioPermissions). The Android foreground service is declared
 * by app/modules/radio-service itself.
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

/**
 * iOS camera prompt. The camera only scans Party and Club QR codes; the
 * in-app explanation before it is in src/permissions/camera.ts.
 */
const CAMERA_USAGE =
  'Hunt Club Mesh uses the camera only to scan party and club QR codes. No photos are taken or saved.';

const config: ExpoConfig = {
  name: 'Hunt Club Mesh',
  slug: 'hunt-club-mesh',
  scheme: URL_SCHEME,
  version: '0.1.0',
  // Each screen locks its own orientation (src/app/_layout.tsx): portrait, and landscape for /board.
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: colors.surface,
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_ID,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_USAGE,
      // Export compliance (App Store Connect): only standard encryption (Meshtastic AES, HTTPS).
      ITSAppUsesNonExemptEncryption: false,
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
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  ...(EAS_PROJECT_ID ? { extra: { eas: { projectId: EAS_PROJECT_ID } } } : {}),
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
    ...RADIO_PLUGINS,
    [
      'expo-camera',
      { cameraPermission: CAMERA_USAGE, microphonePermission: false, recordAudioAndroid: false },
    ],
    'expo-notifications',
  ],
};

export default config;
