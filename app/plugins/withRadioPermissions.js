// Bluetooth permission details that react-native-ble-manager's own config
// plugin leaves out. See docs/research/meshtastic.md §3 "Permissions".
const { withAndroidManifest } = require('expo/config-plugins');

/** Pre-Android 12 Bluetooth permissions; API 31+ uses BLUETOOTH_SCAN/CONNECT. */
const LEGACY_BLUETOOTH = ['android.permission.BLUETOOTH', 'android.permission.BLUETOOTH_ADMIN'];
const LEGACY_MAX_SDK = '30';

const nameOf = (entry) => entry.$['android:name'];

function withRadioPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const permissions = (manifest['uses-permission'] ??= []);
    for (const name of LEGACY_BLUETOOTH) {
      const existing = permissions.find((p) => nameOf(p) === name);
      if (existing) {
        existing.$['android:maxSdkVersion'] = LEGACY_MAX_SDK;
      } else {
        permissions.push({ $: { 'android:name': name, 'android:maxSdkVersion': LEGACY_MAX_SDK } });
      }
    }
    // ble-manager adds location capped at API 30 (only old Android needs it to
    // scan). When another feature (the map) needs location on every version,
    // keep only that uncapped entry so the cap can't hide it on Android 12+.
    const uncapped = new Set(permissions.filter((p) => !p.$['android:maxSdkVersion']).map(nameOf));
    if (manifest['uses-permission-sdk-23']) {
      manifest['uses-permission-sdk-23'] = manifest['uses-permission-sdk-23'].filter(
        (p) => !uncapped.has(nameOf(p)),
      );
    }
    return cfg;
  });
}

module.exports = withRadioPermissions;
