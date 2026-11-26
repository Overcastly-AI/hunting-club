import { Camera } from 'expo-camera';

import { answerAlerts } from '../../test-utils/alerts';
import { PERMISSION_BUTTONS } from '../askPermission';
import { CAMERA_PERMISSION_COPY, ensureCameraPermission } from '../camera';

jest.mock('expo-camera', () => ({
  Camera: { getCameraPermissionsAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() },
}));

const get = jest.mocked(Camera.getCameraPermissionsAsync);
const request = jest.mocked(Camera.requestCameraPermissionsAsync);
const response = (granted: boolean) =>
  ({ granted }) as Awaited<ReturnType<typeof Camera.getCameraPermissionsAsync>>;

beforeEach(() => {
  jest.restoreAllMocks();
  get.mockReset();
  request.mockReset();
});

describe('ensureCameraPermission', () => {
  it('skips the explanation when already allowed', async () => {
    get.mockResolvedValue(response(true));
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    await expect(ensureCameraPermission()).resolves.toBe(true);
    expect(alerts).not.toHaveBeenCalled();
  });

  it('explains why, then shows the system prompt', async () => {
    get.mockResolvedValue(response(false));
    request.mockResolvedValue(response(true));
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    await expect(ensureCameraPermission()).resolves.toBe(true);
    expect(alerts.mock.calls[0]![0]).toBe(CAMERA_PERMISSION_COPY.askTitle);
    expect(request).toHaveBeenCalled();
  });

  it('does not ask the system after "Not now"', async () => {
    get.mockResolvedValue(response(false));
    answerAlerts(PERMISSION_BUTTONS.notNow);
    await expect(ensureCameraPermission()).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
