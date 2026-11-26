import { Alert, Linking } from 'react-native';

import { answerAlerts } from '../../test-utils/alerts';
import { askPermission, PERMISSION_BUTTONS, type PermissionCopy } from '../askPermission';

const COPY: PermissionCopy = {
  askTitle: 'Ask title',
  askBody: 'Why we need it',
  deniedTitle: 'Denied title',
  deniedBody: 'How to fix it',
};

const titles = (spy: jest.SpyInstance) => spy.mock.calls.map((c) => c[0]);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});

describe('askPermission', () => {
  it('explains first, then shows the system prompt', async () => {
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    const request = jest.fn().mockResolvedValue(true);

    await expect(askPermission({ copy: COPY, request })).resolves.toBe(true);

    expect(titles(alerts)).toEqual(['Ask title']);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('skips everything when already granted', async () => {
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    const request = jest.fn();

    await expect(askPermission({ copy: COPY, isGranted: async () => true, request })).resolves.toBe(
      true,
    );

    expect(alerts).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('never shows the system prompt after "Not now"', async () => {
    answerAlerts(PERMISSION_BUTTONS.notNow);
    const request = jest.fn();

    await expect(askPermission({ copy: COPY, request })).resolves.toBe(false);

    expect(request).not.toHaveBeenCalled();
  });

  it('offers Settings when the system refuses', async () => {
    const alerts = answerAlerts((title) =>
      title === 'Ask title' ? PERMISSION_BUTTONS.continue : PERMISSION_BUTTONS.openSettings,
    );

    await expect(askPermission({ copy: COPY, request: async () => false })).resolves.toBe(false);

    expect(titles(alerts)).toEqual(['Ask title', 'Denied title']);
    expect(Linking.openSettings).toHaveBeenCalled();
  });

  it('uses plain words on every button', () => {
    expect(Object.values(PERMISSION_BUTTONS)).toEqual(['Continue', 'Not now', 'Open Settings']);
    expect(Alert.alert).toBeDefined();
  });
});
