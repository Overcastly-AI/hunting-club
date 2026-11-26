import { Pressable, Text } from 'react-native';

/**
 * Stand-ins for the camera (expo-camera has no camera in Jest). Use with
 * `jest.mock('…/components/QrScanner', () => jest.requireActual('…/test-utils/fakeQrScanner').fakeQrScannerModule)`
 * and `jest.mock('…/permissions/camera', () => jest.requireActual('…/test-utils/fakeQrScanner').fakeCameraPermissionModule)`.
 * `scanNext(text)` sets what the next "scan" reads.
 */
let next = '';
export const scanNext = (text: string) => {
  next = text;
};
export const FAKE_SCAN_LABEL = 'Fake scan';

export const fakeQrScannerModule = {
  QrScanner: ({ onScan }: { onScan: (data: string) => void }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={FAKE_SCAN_LABEL}
      onPress={() => onScan(next)}
    >
      <Text>{FAKE_SCAN_LABEL}</Text>
    </Pressable>
  ),
};

export const fakeCameraPermissionModule = {
  ensureCameraPermission: jest.fn(async () => true),
};
