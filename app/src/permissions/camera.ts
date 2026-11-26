import { Camera } from 'expo-camera';

import { askPermission, type PermissionCopy } from './askPermission';

/** Camera is used only to scan Party and Club QR codes. */
export const CAMERA_PERMISSION_COPY: PermissionCopy = {
  askTitle: 'Scan a QR code?',
  askBody:
    'Hunt Club uses the camera only to scan the QR code on another hunter’s phone or your club’s invite. No photos are taken or saved.',
  deniedTitle: 'Camera is off',
  deniedBody: 'To scan a code, allow the camera for Hunt Club in your phone’s Settings.',
};

export function ensureCameraPermission(): Promise<boolean> {
  return askPermission({
    copy: CAMERA_PERMISSION_COPY,
    isGranted: async () => (await Camera.getCameraPermissionsAsync()).granted,
    request: async () => (await Camera.requestCameraPermissionsAsync()).granted,
  });
}
