/**
 * Stand-in for permissions/location (which loads MapLibre native code). Use with
 * `jest.mock('…/permissions/location', () => jest.requireActual('…/test-utils/fakeLocation').fakeLocationModule)`
 * and set each test's position with `jest.mocked(ensureLocationPermission).mockResolvedValue(…)`.
 */
export const fakeLocationModule = { ensureLocationPermission: jest.fn() };
