// Bluetooth permission details that react-native-ble-manager's own config
// plugin leaves out. See docs/research/meshtastic.md §3 "Permissions".
const { withAndroidManifest } = require('expo/config-plugins');

/** Pre-Android 12 Bluetooth permissions; API 31+ uses BLUETOOTH_SCAN/CONNECT. */
const LEGACY_BLUETOOTH = ['android.permission.BLUETOOTH', 'android.permission.BLUETOOTH_ADMIN'];
const LEGACY_MAX_SDK = '30';

function withRadioPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const permissions = (manifest['uses-permission'] ??= []);
    for (const name of LEGACY_BLUETOOTH) {
      const existing = permissions.find((p) => p.$['android:name'] === name);
      if (existing) {
        existing.$['android:maxSdkVersion'] = LEGACY_MAX_SDK;
      } else {
        permissions.push({ $: { 'android:name': name, 'android:maxSdkVersion': LEGACY_MAX_SDK } });
      }
    }
    return cfg;
  });
}

module.exports = withRadioPermissions;
