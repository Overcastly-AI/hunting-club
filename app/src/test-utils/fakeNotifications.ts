/**
 * Stand-in for expo-notifications' permission calls. Use with
 * `jest.mock('expo-notifications', () => jest.requireActual('…/test-utils/fakeNotifications').fakeNotificationsModule)`
 * and script `getPermissionsAsync` / `requestPermissionsAsync` per test.
 */
export const fakeNotificationsModule = {
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
};
