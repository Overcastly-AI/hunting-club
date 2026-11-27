import { CameraView } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';

import { radii } from '../theme';

/** Square camera view; large enough to frame a phone screen at arm's length. */
export const QR_SCANNER_SIZE = 280;

type Props = {
  /** Called once with the first QR code seen. Remount (change `key`) to scan again. */
  onScan: (data: string) => void;
  accessibilityLabel: string;
};

/**
 * The back camera, reading QR codes only. Ask with ensureCameraPermission
 * before showing it. What it reads may hold a channel key: never log it.
 */
export function QrScanner({ onScan, accessibilityLabel }: Props) {
  const scanned = useRef(false);
  return (
    <CameraView
      style={styles.camera}
      facing="back"
      accessibilityLabel={accessibilityLabel}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={({ data }) => {
        if (scanned.current) return;
        scanned.current = true;
        onScan(data);
      }}
    />
  );
}

const styles = StyleSheet.create({
  camera: {
    width: QR_SCANNER_SIZE,
    height: QR_SCANNER_SIZE,
    alignSelf: 'center',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
});
